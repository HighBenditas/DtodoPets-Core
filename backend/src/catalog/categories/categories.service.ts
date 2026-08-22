import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPage, getPagination } from '../../common/pagination/pagination';
import { ListQueryDto } from '../../common/pagination/pagination-query.dto';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getValidSlug, throwCatalogConflict } from '../brands/brands.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  _count: { select: { children: true, products: true } },
} as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ListQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.CategoryWhereInput = {
      organizationId,
      active: query.active,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: categoryInclude,
        ...getPagination(query),
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, organizationId },
      include: categoryInclude,
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async create(organizationId: string, dto: CreateCategoryDto) {
    await this.validateParent(organizationId, dto.parentId);
    try {
      return await this.prisma.category.create({
        data: {
          active: dto.active ?? true,
          name: dto.name.trim(),
          organizationId,
          parentId: dto.parentId,
          slug: getValidSlug(dto.slug ?? dto.name),
        },
        include: categoryInclude,
      });
    } catch (error) {
      throwCatalogConflict(error, 'Category slug is already in use');
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(organizationId, id);
    if (dto.parentId !== undefined) {
      await this.validateParent(organizationId, dto.parentId ?? undefined, id);
    }
    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = getValidSlug(dto.slug);
    if (dto.parentId !== undefined) data.parentId = dto.parentId;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
        include: categoryInclude,
      });
    } catch (error) {
      throwCatalogConflict(error, 'Category slug is already in use');
      throw error;
    }
  }

  private async validateParent(
    organizationId: string,
    parentId: string | undefined,
    categoryId?: string,
  ) {
    if (!parentId) return;
    const visited = new Set<string>();
    let currentId: string | null = parentId;

    while (currentId) {
      if (currentId === categoryId || visited.has(currentId)) {
        throw new BadRequestException(
          'Category hierarchy would contain a cycle',
        );
      }
      visited.add(currentId);
      const category: { parentId: string | null } | null =
        await this.prisma.category.findFirst({
          where: { id: currentId, organizationId },
          select: { parentId: true },
        });
      if (!category) throw new BadRequestException('parentId is invalid');
      currentId = category.parentId;
    }
  }
}
