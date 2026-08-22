import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPage, getPagination } from '../common/pagination/pagination';
import { ListQueryDto } from '../common/pagination/pagination-query.dto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';

const warehouseInclude = {
  location: {
    select: { id: true, name: true },
  },
} as const;

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WarehouseWhereInput = {
      organizationId,
      active: query.active,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              {
                location: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.warehouse.findMany({
        where,
        include: warehouseInclude,
        ...getPagination(query),
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, organizationId },
      include: warehouseInclude,
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  async create(organizationId: string, dto: CreateWarehouseDto) {
    await this.validateLocation(organizationId, dto.locationId);

    try {
      return await this.prisma.warehouse.create({
        data: {
          active: dto.active ?? true,
          locationId: dto.locationId,
          name: dto.name.trim(),
          organizationId,
        },
        include: warehouseInclude,
      });
    } catch (error) {
      throwWarehouseConflict(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateWarehouseDto) {
    await this.findOne(organizationId, id);
    await this.validateLocation(organizationId, dto.locationId ?? undefined);
    const data: Prisma.WarehouseUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.locationId !== undefined) {
      data.locationId = dto.locationId;
    }
    if (dto.active !== undefined) {
      data.active = dto.active;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data,
        include: warehouseInclude,
      });
    } catch (error) {
      throwWarehouseConflict(error);
      throw error;
    }
  }

  private async validateLocation(
    organizationId: string,
    locationId: string | undefined,
  ) {
    if (!locationId) {
      return;
    }

    const location = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
      select: { id: true },
    });

    if (!location) {
      throw new BadRequestException('locationId is invalid');
    }
  }
}

function throwWarehouseConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Warehouse name is already in use');
  }
}
