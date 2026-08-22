import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleInclude = {
  permissions: {
    include: { permission: true },
    orderBy: { permission: { key: 'asc' as const } },
  },
  _count: { select: { users: true } },
} as const;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: roleInclude,
      orderBy: [{ system: 'desc' }, { name: 'asc' }],
    });
  }

  async create(organizationId: string, dto: CreateRoleDto) {
    const permissionIds = await this.findPermissionIds(dto.permissionKeys);

    try {
      return await this.prisma.role.create({
        data: {
          description: dto.description?.trim(),
          key: dto.key.trim().toLowerCase(),
          name: dto.name.trim(),
          organizationId,
          permissions: {
            create: permissionIds.map((permissionId) => ({ permissionId })),
          },
        },
        include: roleInclude,
      });
    } catch (error) {
      throwRoleConflict(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateRoleDto) {
    await this.findMutableRole(organizationId, id);
    const data: Prisma.RoleUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    return this.prisma.role.update({
      where: { id },
      data,
      include: roleInclude,
    });
  }

  async updatePermissions(
    organizationId: string,
    id: string,
    dto: UpdateRolePermissionsDto,
  ) {
    await this.findMutableRole(organizationId, id);
    const permissionIds = await this.findPermissionIds(dto.permissionKeys);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionIds.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            permissionId,
            roleId: id,
          })),
        });
      }
    });

    return this.prisma.role.findUniqueOrThrow({
      where: { id },
      include: roleInclude,
    });
  }

  async remove(organizationId: string, id: string) {
    const role = await this.findMutableRole(organizationId, id);

    if (role._count.users > 0) {
      throw new ConflictException('Role is assigned to one or more users');
    }

    await this.prisma.role.delete({ where: { id } });
  }

  private async findMutableRole(organizationId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, organizationId },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    if (role.system) {
      throw new ForbiddenException('System roles cannot be modified');
    }

    return role;
  }

  private async findPermissionIds(permissionKeys: string[]) {
    const uniqueKeys = [...new Set(permissionKeys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
      select: { id: true },
    });

    if (permissions.length !== uniqueKeys.length) {
      throw new BadRequestException('One or more permissions are invalid');
    }

    return permissions.map(({ id }) => id);
  }
}

function throwRoleConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Role key is already in use');
  }
}
