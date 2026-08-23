import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal } from '../auth.types';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndMerge: jest.fn(),
    getAllAndOverride: jest.fn(),
  };
  const guard = new PermissionsGuard(reflector as unknown as Reflector);

  beforeEach(() => {
    reflector.getAllAndMerge.mockReset();
    reflector.getAllAndOverride.mockReset();
  });

  it('allows an explicitly public route even when its controller requires permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    reflector.getAllAndMerge.mockReturnValue(['integrations.manage']);

    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('allows a principal with every required permission', () => {
    reflector.getAllAndMerge.mockReturnValue(['users.manage']);
    expect(
      guard.canActivate(createContext(createPrincipal(['users.manage']))),
    ).toBe(true);
  });

  it('denies a principal missing a required permission', () => {
    reflector.getAllAndMerge.mockReturnValue(['users.manage']);
    expect(() => guard.canActivate(createContext(createPrincipal([])))).toThrow(
      ForbiddenException,
    );
  });
});

function createContext(principal: AuthenticatedPrincipal | undefined) {
  return {
    getClass: () => class TestController {},
    getHandler: () => () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: principal }) }),
  } as unknown as ExecutionContext;
}

function createPrincipal(permissions: string[]): AuthenticatedPrincipal {
  return {
    email: 'user@example.com',
    firstName: 'User',
    id: 'user-id',
    lastName: null,
    organizationId: 'org-id',
    organizationSlug: 'org',
    permissions,
    roles: ['viewer'],
    sessionId: 'session-id',
  };
}
