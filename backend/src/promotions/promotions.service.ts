import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toClpDecimal } from '../common/money/clp';
import { createPage, getPagination } from '../common/pagination/pagination';
import {
  Prisma,
  PromotionScope,
  PromotionType,
  SalesChannelType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePromotionDto,
  PromotionQueryDto,
  UpdatePromotionDto,
} from './dto/promotion.dto';

export const promotionInclude = {
  _count: { select: { redemptions: true } },
  salesChannel: { select: { id: true, key: true, name: true } },
  variants: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PromotionInclude;

export type PromotionWithVariants = Prisma.PromotionGetPayload<{
  include: typeof promotionInclude;
}>;

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: PromotionQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.PromotionWhereInput = {
      active: query.active,
      organizationId,
      salesChannelId: query.salesChannelId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.promotion.findMany({
      where,
      include: promotionInclude,
      ...getPagination(query),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const total = await this.prisma.promotion.count({ where });
    return createPage(rows, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const promotion = await this.prisma.promotion.findFirst({
      where: { id, organizationId },
      include: promotionInclude,
    });
    if (!promotion) throw new NotFoundException('Promotion not found');
    return promotion;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePromotionDto,
  ) {
    validateDefinition(dto);
    await this.validateChannel(organizationId, dto.salesChannelId);
    await this.validateVariants(organizationId, dto.scope, dto.variantIds);
    const code = normalizedPromotionCode(dto.code);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const promotion = await tx.promotion.create({
          data: {
            automatic: dto.automatic,
            code,
            createdByUserId: actorUserId,
            description: optionalText(dto.description),
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
            maximumDiscountAmount:
              dto.maximumDiscountAmount === undefined
                ? null
                : toClpDecimal(dto.maximumDiscountAmount),
            minimumSubtotalAmount: toClpDecimal(dto.minimumSubtotalAmount ?? 0),
            name: requiredText(dto.name),
            organizationId,
            priority: dto.priority ?? 0,
            salesChannelId: dto.salesChannelId,
            scope: dto.scope,
            startsAt: new Date(dto.startsAt),
            type: dto.type,
            value: dto.value,
            variants:
              dto.scope === PromotionScope.VARIANTS
                ? {
                    create: dto.variantIds!.map((variantId) => ({
                      organizationId,
                      variantId,
                    })),
                  }
                : undefined,
          },
          include: promotionInclude,
        });
        return promotion;
      });
    } catch (error) {
      throwUnique(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdatePromotionDto) {
    const current = await this.findOne(organizationId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt =
      dto.endsAt === undefined
        ? current.endsAt
        : dto.endsAt === null
          ? null
          : new Date(dto.endsAt);
    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    return this.prisma.promotion.update({
      where: { id },
      data: {
        active: dto.active,
        description:
          dto.description === undefined
            ? undefined
            : optionalText(dto.description),
        endsAt,
        name: dto.name === undefined ? undefined : requiredText(dto.name),
        priority: dto.priority,
        startsAt,
      },
      include: promotionInclude,
    });
  }

  findActiveAutomatic(
    organizationId: string,
    salesChannelId: string,
    at: Date,
  ) {
    return this.prisma.promotion.findMany({
      where: activeWhere(organizationId, salesChannelId, at, {
        automatic: true,
      }),
      include: promotionInclude,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async findActiveByCode(
    organizationId: string,
    salesChannelId: string,
    code: string,
    at: Date,
  ) {
    const promotion = await this.prisma.promotion.findFirst({
      where: activeWhere(organizationId, salesChannelId, at, {
        automatic: false,
        code: normalizedPromotionCode(code),
      }),
      include: promotionInclude,
    });
    if (!promotion) throw new BadRequestException('Promotion code is invalid');
    return promotion;
  }

  private async validateChannel(
    organizationId: string,
    salesChannelId: string | undefined,
  ) {
    if (!salesChannelId) return;
    const channel = await this.prisma.salesChannel.findFirst({
      where: {
        id: salesChannelId,
        organizationId,
        type: SalesChannelType.OWN_STOREFRONT,
      },
      select: { id: true },
    });
    if (!channel) {
      throw new BadRequestException(
        'salesChannelId must reference an own storefront',
      );
    }
  }

  private async validateVariants(
    organizationId: string,
    scope: PromotionScope,
    variantIds: string[] | undefined,
  ) {
    if (scope === PromotionScope.ALL_CATALOG) {
      if (variantIds?.length) {
        throw new BadRequestException(
          'variantIds must be empty for ALL_CATALOG',
        );
      }
      return;
    }
    if (!variantIds?.length) {
      throw new BadRequestException('variantIds are required for VARIANTS');
    }
    const count = await this.prisma.productVariant.count({
      where: {
        active: true,
        id: { in: variantIds },
        organizationId,
        product: { is: { active: true } },
      },
    });
    if (count !== variantIds.length) {
      throw new BadRequestException('One or more variantIds are invalid');
    }
  }
}

function validateDefinition(dto: CreatePromotionDto) {
  if (dto.automatic === Boolean(dto.code?.trim())) {
    throw new BadRequestException(
      'Automatic promotions cannot have a code; coupon promotions require one',
    );
  }
  if (dto.type === PromotionType.PERCENTAGE && dto.value > 100) {
    throw new BadRequestException(
      'Percentage promotion value cannot exceed 100',
    );
  }
  const startsAt = new Date(dto.startsAt);
  const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
}

function activeWhere(
  organizationId: string,
  salesChannelId: string,
  at: Date,
  extra: Prisma.PromotionWhereInput,
): Prisma.PromotionWhereInput {
  return {
    ...extra,
    active: true,
    AND: [
      { OR: [{ salesChannelId: null }, { salesChannelId }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: at } }] },
    ],
    organizationId,
    startsAt: { lte: at },
  };
}

export function normalizedPromotionCode(value: string | undefined) {
  const code = value?.trim().toUpperCase();
  return code || null;
}

function requiredText(value: string) {
  const text = value.trim();
  if (!text) throw new BadRequestException('name must not be blank');
  return text;
}

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

function throwUnique(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Promotion code is already in use');
  }
}
