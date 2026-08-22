import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { normalizeEmail } from '../common/text/normalization';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const publicUserSelect = {
  active: true,
  createdAt: true,
  email: true,
  firstName: true,
  id: true,
  lastName: true,
  organizationId: true,
  roles: {
    select: { role: { select: { key: true, name: true } } },
  },
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  findAll(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
      select: publicUserSelect,
    });
  }

  async findOne(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateUserDto) {
    assertCanAssignRoles(principal, dto.roleKeys);
    const roles = await this.findRoles(principal.organizationId, dto.roleKeys);
    const passwordHash = await this.passwordService.hash(dto.password);

    try {
      return await this.prisma.user.create({
        data: {
          email: normalizeEmail(dto.email),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName?.trim(),
          organizationId: principal.organizationId,
          passwordHash,
          roles: {
            create: roles.map((role) => ({ roleId: role.id })),
          },
        },
        select: publicUserSelect,
      });
    } catch (error) {
      throwUserConflict(error);
      throw error;
    }
  }

  async update(
    principal: AuthenticatedPrincipal,
    id: string,
    dto: UpdateUserDto,
  ) {
    const current = await this.findOne(principal.organizationId, id);
    assertCanManageUser(
      principal,
      current.roles.map(({ role }) => role.key),
    );

    if (dto.active === false && principal.id === id) {
      throw new BadRequestException('Current user cannot deactivate itself');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      data.firstName = dto.firstName.trim();
    }
    if (dto.lastName !== undefined) {
      data.lastName = dto.lastName.trim();
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }

  async updateRoles(
    principal: AuthenticatedPrincipal,
    id: string,
    dto: UpdateUserRolesDto,
  ) {
    const current = await this.findOne(principal.organizationId, id);
    const currentRoleKeys = current.roles.map(({ role }) => role.key);
    assertCanManageUser(principal, currentRoleKeys);
    assertCanAssignRoles(principal, dto.roleKeys);
    const roles = await this.findRoles(principal.organizationId, dto.roleKeys);

    if (currentRoleKeys.includes('owner') && !dto.roleKeys.includes('owner')) {
      const activeOwners = await this.prisma.userRole.count({
        where: {
          role: { key: 'owner', organizationId: principal.organizationId },
          user: { active: true, organizationId: principal.organizationId },
        },
      });

      if (activeOwners <= 1) {
        throw new ConflictException('Organization must keep an active owner');
      }
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId: id } });
      await transaction.userRole.createMany({
        data: roles.map((role) => ({ roleId: role.id, userId: id })),
      });
    });

    return this.findOne(principal.organizationId, id);
  }

  private async findRoles(organizationId: string, roleKeys: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { key: { in: roleKeys }, organizationId },
      select: { id: true, key: true },
    });

    if (roles.length !== roleKeys.length) {
      throw new BadRequestException('One or more roles are invalid');
    }

    return roles;
  }
}

function assertCanAssignRoles(
  principal: AuthenticatedPrincipal,
  roleKeys: string[],
) {
  if (roleKeys.includes('owner') && !principal.roles.includes('owner')) {
    throw new ForbiddenException('Only an owner can assign the owner role');
  }
}

function assertCanManageUser(
  principal: AuthenticatedPrincipal,
  targetRoleKeys: string[],
) {
  if (targetRoleKeys.includes('owner') && !principal.roles.includes('owner')) {
    throw new ForbiddenException('Only an owner can manage another owner');
  }
}

function throwUserConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Email is already in use in this organization');
  }
}
