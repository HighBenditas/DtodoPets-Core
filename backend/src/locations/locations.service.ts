import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListQueryDto } from '../common/pagination/pagination-query.dto';
import { createPage, getPagination } from '../common/pagination/pagination';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.LocationWhereInput = {
      organizationId,
      active: query.active,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { commune: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({
        where,
        ...getPagination(query),
        orderBy: { name: 'asc' },
      }),
      this.prisma.location.count({ where }),
    ]);

    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, organizationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async create(organizationId: string, dto: CreateLocationDto) {
    try {
      return await this.prisma.location.create({
        data: {
          addressLine1: normalizeOptionalText(dto.addressLine1),
          addressLine2: normalizeOptionalText(dto.addressLine2),
          active: dto.active ?? true,
          city: normalizeOptionalText(dto.city),
          commune: normalizeOptionalText(dto.commune),
          name: dto.name.trim(),
          organizationId,
          region: normalizeOptionalText(dto.region),
        },
      });
    } catch (error) {
      throwLocationConflict(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateLocationDto) {
    await this.findOne(organizationId, id);
    const data: Prisma.LocationUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.addressLine1 !== undefined) {
      data.addressLine1 = dto.addressLine1.trim() || null;
    }
    if (dto.addressLine2 !== undefined) {
      data.addressLine2 = dto.addressLine2.trim() || null;
    }
    if (dto.commune !== undefined) {
      data.commune = dto.commune.trim() || null;
    }
    if (dto.city !== undefined) {
      data.city = dto.city.trim() || null;
    }
    if (dto.region !== undefined) {
      data.region = dto.region.trim() || null;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.location.update({ where: { id }, data });
    } catch (error) {
      throwLocationConflict(error);
      throw error;
    }
  }
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function throwLocationConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Location name is already in use');
  }
}
