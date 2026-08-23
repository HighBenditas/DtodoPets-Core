import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { AuditOutcome } from '../generated/prisma/client';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

const principal: AuthenticatedPrincipal = {
  email: 'admin@example.com',
  firstName: 'Admin',
  id: 'user-a',
  lastName: null,
  organizationId: 'org-a',
  organizationSlug: 'tenant-a',
  permissions: [],
  roles: ['owner'],
  sessionId: 'session-a',
};

class ProductsController {}

function create(this: void) {}

function executionContext(options: {
  method?: string;
  params?: Record<string, string>;
  user?: AuthenticatedPrincipal;
}) {
  const request = {
    headers: { 'x-correlation-id': 'corr-a' },
    method: options.method ?? 'POST',
    params: options.params ?? {},
    route: { path: '/api/v1/products/:id' },
    socket: { remoteAddress: '127.0.0.1' },
    user: options.user,
  };
  const response = { statusCode: 201 } as Response;
  return {
    getClass: () => ProductsController,
    getHandler: () => create,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let audit: { finish: jest.Mock; start: jest.Mock };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    audit = {
      finish: jest.fn().mockResolvedValue(undefined),
      start: jest.fn().mockResolvedValue({
        id: 'audit-a',
        startedAt: new Date(),
      }),
    };
    interceptor = new AuditInterceptor(audit as unknown as AuditService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a successful authenticated mutation and returned resource ID', async () => {
    const handler: CallHandler = {
      handle: () => of({ id: 'product-a' }),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(executionContext({ user: principal }), handler),
      ),
    ).resolves.toEqual({ id: 'product-a' });
    expect(audit.start).toHaveBeenCalledWith(
      principal,
      expect.objectContaining({
        action: 'ProductsController.create',
        correlationId: 'corr-a',
        method: 'POST',
        resourceType: 'products',
      }),
    );
    expect(audit.finish).toHaveBeenCalledWith(
      'org-a',
      'audit-a',
      expect.any(Date),
      expect.objectContaining({
        httpStatus: 201,
        outcome: AuditOutcome.SUCCEEDED,
        resourceId: 'product-a',
      }),
    );
  });

  it('records a failed mutation without storing its error message', async () => {
    const handler: CallHandler = {
      handle: () => throwError(() => new BadRequestException('private input')),
    };

    await expect(
      lastValueFrom(
        interceptor.intercept(
          executionContext({ params: { id: 'product-a' }, user: principal }),
          handler,
        ),
      ),
    ).rejects.toThrow('private input');
    expect(audit.finish).toHaveBeenCalledWith(
      'org-a',
      'audit-a',
      expect.any(Date),
      expect.objectContaining({
        httpStatus: 400,
        outcome: AuditOutcome.FAILED,
        resourceId: 'product-a',
      }),
    );
    expect(JSON.stringify(audit.finish.mock.calls)).not.toContain(
      'private input',
    );
  });

  it('does not audit public or read-only requests without a principal', async () => {
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    await lastValueFrom(interceptor.intercept(executionContext({}), handler));
    await lastValueFrom(
      interceptor.intercept(
        executionContext({ method: 'GET', user: principal }),
        handler,
      ),
    );

    expect(audit.start).not.toHaveBeenCalled();
  });

  it('returns the successful business response if audit finalization fails', async () => {
    audit.finish.mockRejectedValue(new Error('audit unavailable'));
    const handler: CallHandler = { handle: () => of({ id: 'product-a' }) };

    await expect(
      lastValueFrom(
        interceptor.intercept(executionContext({ user: principal }), handler),
      ),
    ).resolves.toEqual({ id: 'product-a' });
  });

  it('does not execute a mutation when its audit attempt cannot be persisted', async () => {
    audit.start.mockRejectedValue(new Error('audit unavailable'));
    const handle = jest.fn(() => of({ ok: true }));
    const handler: CallHandler = { handle };

    await expect(
      lastValueFrom(
        interceptor.intercept(executionContext({ user: principal }), handler),
      ),
    ).rejects.toThrow('audit unavailable');
    expect(handle).not.toHaveBeenCalled();
    expect(audit.finish).not.toHaveBeenCalled();
  });
});
