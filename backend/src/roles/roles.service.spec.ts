import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: {
    permission: { findMany: jest.Mock };
    role: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      permission: { findMany: jest.fn() },
      role: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [RolesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RolesService);
  });

  it('creates custom roles inside the authenticated organization', async () => {
    let createCall: unknown;
    prisma.permission.findMany.mockResolvedValue([{ id: 'permission-id' }]);
    prisma.role.create.mockImplementation((input: unknown) => {
      createCall = input;
      return Promise.resolve({ id: 'role-id' });
    });

    await service.create('org-a', {
      key: 'catalog-editor',
      name: 'Catalog Editor',
      permissionKeys: ['products.update'],
    });

    expect(createCall).toMatchObject({
      data: {
        key: 'catalog-editor',
        organizationId: 'org-a',
        permissions: { create: [{ permissionId: 'permission-id' }] },
      },
    });
  });

  it('does not modify system roles', async () => {
    prisma.role.findFirst.mockResolvedValue({
      _count: { users: 1 },
      id: 'owner-role',
      system: true,
    });

    await expect(
      service.update('org-a', 'owner-role', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal roles from another organization', async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    await expect(
      service.update('org-a', 'role-from-org-b', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      include: { _count: { select: { users: true } } },
      where: { id: 'role-from-org-b', organizationId: 'org-a' },
    });
  });
});
