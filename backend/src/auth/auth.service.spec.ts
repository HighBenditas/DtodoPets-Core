import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_ENVIRONMENT, AuthEnvironment } from './auth.config';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('AuthService', () => {
  const environment: AuthEnvironment = {
    accessTokenTtlSeconds: 900,
    jwtAccessSecret: 'unit-test-secret-with-at-least-32-characters',
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  };
  const authorizedUser = {
    active: true,
    email: 'owner@dtodopets.local',
    firstName: 'Owner',
    id: 'user-id',
    lastName: null,
    organization: { active: true, id: 'org-id', slug: 'dtodopets' },
    organizationId: 'org-id',
    passwordHash: 'stored-password-hash',
    roles: [
      {
        role: {
          key: 'owner',
          permissions: [
            { permission: { key: 'organizations.read' } },
            { permission: { key: 'users.manage' } },
          ],
        },
      },
    ],
  };
  let service: AuthService;
  let prisma: {
    authSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    user: { findFirst: jest.Mock };
  };
  let passwordService: { hash: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      authSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      user: { findFirst: jest.fn() },
    };
    passwordService = { hash: jest.fn(), verify: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        JwtService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
        { provide: AUTH_ENVIRONMENT, useValue: environment },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('logs in using a normalized tenant and email', async () => {
    prisma.user.findFirst.mockResolvedValue(authorizedUser);
    passwordService.verify.mockResolvedValue(true);
    prisma.authSession.create.mockResolvedValue({ id: 'session-id' });

    const result = await service.login({
      email: ' OWNER@DTODOPETS.LOCAL ',
      organizationSlug: ' DTodoPets ',
      password: 'valid-password',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          email: 'owner@dtodopets.local',
          organization: { active: true, slug: 'dtodopets' },
        },
      }),
    );
    expect(result).toMatchObject({
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        organizationId: 'org-id',
        permissions: ['organizations.read', 'users.manage'],
        roles: ['owner'],
      },
    });
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it('does not reveal whether a user exists', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@dtodopets.local',
        organizationSlug: 'dtodopets',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates an access token only while its session is active', async () => {
    prisma.user.findFirst.mockResolvedValue(authorizedUser);
    passwordService.verify.mockResolvedValue(true);
    prisma.authSession.create.mockResolvedValue({ id: 'session-id' });
    const login = await service.login({
      email: authorizedUser.email,
      organizationSlug: 'dtodopets',
      password: 'valid-password',
    });
    prisma.authSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-id',
      revokedAt: null,
      user: authorizedUser,
      userId: authorizedUser.id,
    });

    await expect(
      service.authenticate(login.accessToken),
    ).resolves.toMatchObject({
      id: authorizedUser.id,
      organizationId: authorizedUser.organizationId,
      sessionId: 'session-id',
    });

    prisma.authSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-id',
      revokedAt: new Date(),
      user: authorizedUser,
      userId: authorizedUser.id,
    });
    await expect(
      service.authenticate(login.accessToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates a refresh token atomically', async () => {
    let updateCall: unknown;
    prisma.authSession.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      id: 'session-id',
      revokedAt: null,
      user: authorizedUser,
      userId: authorizedUser.id,
    });
    prisma.authSession.updateMany.mockImplementation((input: unknown) => {
      updateCall = input;
      return Promise.resolve({ count: 1 });
    });

    const result = await service.refresh('original-refresh-token');

    expect(result.refreshToken).not.toBe('original-refresh-token');
    expect(updateCall).toMatchObject({
      where: { id: 'session-id', revokedAt: null },
    });
  });
});
