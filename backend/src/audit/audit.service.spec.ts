import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AuditOutcome, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@example.com',
  firstName: 'Admin',
  id: '550e8400-e29b-41d4-a716-446655440001',
  lastName: null,
  organizationId: '550e8400-e29b-41d4-a716-446655440002',
  organizationSlug: 'tenant-a',
  permissions: [],
  roles: ['owner'],
  sessionId: '550e8400-e29b-41d4-a716-446655440003',
};

describe('AuditService', () => {
  let service: AuditService;
  let prisma: {
    auditLog: {
      count: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      auditLog: {
        count: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AuditService);
  });

  it('scopes paginated audit queries to the authenticated tenant', async () => {
    let query: Prisma.AuditLogFindManyArgs | undefined;
    prisma.auditLog.findMany.mockImplementation(
      (input: Prisma.AuditLogFindManyArgs) => {
        query = input;
        return Promise.resolve([{ id: 'audit-a' }]);
      },
    );
    prisma.auditLog.count.mockResolvedValue(1);

    const result = await service.findAll(principal.organizationId, {
      limit: 20,
      method: 'PATCH',
      page: 1,
      search: 'Products',
    });

    expect(query?.where).toMatchObject({
      method: 'PATCH',
      organizationId: principal.organizationId,
    });
    expect(result.meta).toEqual({
      limit: 20,
      page: 1,
      pageCount: 1,
      total: 1,
    });
  });

  it('rejects an inverted date range before querying PostgreSQL', async () => {
    await expect(
      service.findAll(principal.organizationId, {
        from: '2026-08-23T00:00:00.000Z',
        limit: 20,
        page: 1,
        to: '2026-08-22T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });

  it('starts an audit with actor and tenant but without request payload data', async () => {
    let data: Prisma.AuditLogUncheckedCreateInput | undefined;
    prisma.auditLog.create.mockImplementation(
      (input: { data: Prisma.AuditLogUncheckedCreateInput }) => {
        data = input.data;
        return Promise.resolve({ id: 'audit-a', startedAt: new Date() });
      },
    );

    await service.start(principal, {
      action: 'ProductsController.create',
      correlationId: 'corr-a',
      ipAddress: '127.0.0.1',
      method: 'POST',
      resourceType: 'products',
      route: '/api/v1/products',
    });

    expect(data).toMatchObject({
      action: 'ProductsController.create',
      actorUserId: principal.id,
      organizationId: principal.organizationId,
      sessionId: principal.sessionId,
    });
    expect(data).not.toHaveProperty('body');
    expect(data).not.toHaveProperty('metadata');
  });

  it('finalizes only an attempted audit in the same tenant', async () => {
    let query: Prisma.AuditLogUpdateManyArgs | undefined;
    prisma.auditLog.updateMany.mockImplementation(
      (input: Prisma.AuditLogUpdateManyArgs) => {
        query = input;
        return Promise.resolve({ count: 1 });
      },
    );
    const startedAt = new Date();

    await service.finish(principal.organizationId, 'audit-a', startedAt, {
      durationMs: 12.9,
      httpStatus: 201,
      outcome: AuditOutcome.SUCCEEDED,
      resourceId: 'resource-a',
    });

    expect(query?.where).toEqual({
      id: 'audit-a',
      organizationId: principal.organizationId,
      outcome: AuditOutcome.ATTEMPTED,
    });
    expect(query?.data).toMatchObject({
      durationMs: 12,
      httpStatus: 201,
      outcome: AuditOutcome.SUCCEEDED,
      resourceId: 'resource-a',
    });
  });

  it('rejects finalization when no attempted audit matches the tenant', async () => {
    prisma.auditLog.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.finish(principal.organizationId, 'audit-a', new Date(), {
        durationMs: 1,
        httpStatus: 200,
        outcome: AuditOutcome.SUCCEEDED,
      }),
    ).rejects.toThrow('Audit log could not be finalized');
  });
});
