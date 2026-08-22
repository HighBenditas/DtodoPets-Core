import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const principal: AuthenticatedPrincipal = {
    email: 'owner@dtodopets.local',
    firstName: 'Owner',
    id: 'actor-id',
    lastName: null,
    organizationId: 'org-a',
    organizationSlug: 'org-a',
    permissions: ['users.manage'],
    roles: ['owner'],
    sessionId: 'session-id',
  };
  let service: UsersService;
  let prisma: {
    role: { findMany: jest.Mock };
    user: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    userRole: { count: jest.Mock };
  };
  const passwordService = { hash: jest.fn(), verify: jest.fn() };

  beforeEach(async () => {
    prisma = {
      role: { findMany: jest.fn() },
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      userRole: { count: jest.fn() },
    };
    passwordService.hash.mockReset().mockResolvedValue('password-hash');
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('always creates users inside the authenticated organization', async () => {
    let createCall: unknown;
    prisma.role.findMany.mockResolvedValue([
      { id: 'seller-role', key: 'seller' },
    ]);
    prisma.user.create.mockImplementation((input: unknown) => {
      createCall = input;
      return Promise.resolve({ id: 'new-user' });
    });

    await service.create(principal, {
      email: ' SELLER@EXAMPLE.COM ',
      firstName: ' Seller ',
      password: 'Development-password-123!',
      roleKeys: ['seller'],
    });

    expect(createCall).toMatchObject({
      data: {
        email: 'seller@example.com',
        organizationId: 'org-a',
        roles: { create: [{ roleId: 'seller-role' }] },
      },
    });
  });

  it('prevents a non-owner from granting the owner role', async () => {
    await expect(
      service.create(
        { ...principal, roles: ['admin'] },
        {
          email: 'user@example.com',
          firstName: 'User',
          password: 'Development-password-123!',
          roleKeys: ['owner'],
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('does not return a user from another organization', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.findOne('org-a', 'user-from-org-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-from-org-b', organizationId: 'org-a' },
      }),
    );
  });
});
