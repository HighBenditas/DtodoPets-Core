import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const name = normalizeRequiredString(createOrganizationDto.name, 'name');
    const slug = normalizeSlug(createOrganizationDto.slug ?? name);

    try {
      return await this.prisma.organization.create({
        data: {
          name,
          slug,
          active: createOrganizationDto.active ?? true,
        },
      });
    } catch (error) {
      throwPrismaConflict(error, 'Organization slug is already in use');
      throw error;
    }
  }

  findAll(organizationId: string) {
    return this.prisma.organization.findMany({
      where: { id: organizationId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: {
        id,
      },
    });

    if (!organization || organization.id !== organizationId) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(
    organizationId: string,
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
  ) {
    await this.findOne(organizationId, id);
    const data = buildUpdateData(updateOrganizationDto);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.organization.update({
        where: {
          id,
        },
        data,
      });
    } catch (error) {
      throwPrismaNotFound(error);
      throwPrismaConflict(error, 'Organization slug is already in use');
      throw error;
    }
  }
}

function buildUpdateData(
  updateOrganizationDto: UpdateOrganizationDto,
): Prisma.OrganizationUpdateInput {
  const data: Prisma.OrganizationUpdateInput = {};

  if (updateOrganizationDto.name !== undefined) {
    data.name = normalizeRequiredString(updateOrganizationDto.name, 'name');
  }

  if (updateOrganizationDto.slug !== undefined) {
    data.slug = normalizeSlug(updateOrganizationDto.slug);
  }

  return data;
}

function normalizeRequiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }

  return value.trim();
}

function normalizeSlug(value: unknown) {
  const rawSlug = normalizeRequiredString(value, 'slug')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const slug = rawSlug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  if (!slug) {
    throw new BadRequestException('slug must contain letters or numbers');
  }

  return slug;
}

function throwPrismaConflict(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
}

function throwPrismaNotFound(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    throw new NotFoundException('Organization not found');
  }
}
