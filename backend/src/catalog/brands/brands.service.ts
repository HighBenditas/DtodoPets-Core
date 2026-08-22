import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPage, getPagination } from '../../common/pagination/pagination';
import { ListQueryDto } from '../../common/pagination/pagination-query.dto';
import { normalizeSlug } from '../../common/text/normalization';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.BrandWhereInput = {
      organizationId,
      active: query.active,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        ...getPagination(query),
        orderBy: { name: 'asc' },
      }),
      this.prisma.brand.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, organizationId },
    });
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    return brand;
  }

  async create(organizationId: string, dto: CreateBrandDto) {
    const slug = getValidSlug(dto.slug ?? dto.name);

    try {
      return await this.prisma.brand.create({
        data: {
          active: dto.active ?? true,
          name: dto.name.trim(),
          organizationId,
          slug,
        },
      });
    } catch (error) {
      throwCatalogConflict(error, 'Brand slug is already in use');
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateBrandDto) {
    await this.findOne(organizationId, id);
    const data: Prisma.BrandUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = getValidSlug(dto.slug);
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.brand.update({ where: { id }, data });
    } catch (error) {
      throwCatalogConflict(error, 'Brand slug is already in use');
      throw error;
    }
  }
}

export function getValidSlug(value: string) {
  const slug = normalizeSlug(value);
  if (!slug) throw new BadRequestException('slug is invalid');
  return slug;
}

export function throwCatalogConflict(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(message);
  }
}
