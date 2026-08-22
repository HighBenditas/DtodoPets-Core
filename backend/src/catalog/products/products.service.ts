import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertValidSalePrice, toClpDecimal } from '../../common/money/clp';
import { createPage, getPagination } from '../../common/pagination/pagination';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getValidSlug } from '../brands/brands.service';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductImageDto } from './dto/product-image.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productInclude = {
  brand: { select: { id: true, name: true, slug: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  variants: { orderBy: { sku: 'asc' } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ProductQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      organizationId,
      active: query.active,
      brandId: query.brandId,
      categoryId: query.categoryId,
      species: query.species
        ? { equals: query.species.trim(), mode: 'insensitive' }
        : undefined,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
              {
                variants: {
                  some: {
                    OR: [
                      { sku: { contains: search, mode: 'insensitive' } },
                      { barcode: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        ...getPagination(query),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(organizationId: string, dto: CreateProductDto) {
    await this.validateReferences(organizationId, dto.brandId, dto.categoryId);
    validateVariantCollection(dto.variants);
    validateImageCollection(dto.images ?? []);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            active: dto.active ?? true,
            brandId: dto.brandId,
            categoryId: dto.categoryId,
            description: normalizeOptionalText(dto.description),
            lifeStage: normalizeOptionalText(dto.lifeStage),
            name: dto.name.trim(),
            organizationId,
            slug: getValidSlug(dto.slug ?? dto.name),
            species: normalizeOptionalText(dto.species),
          },
        });
        await transaction.productVariant.createMany({
          data: dto.variants.map((variant) =>
            toVariantCreateData(organizationId, product.id, variant),
          ),
        });
        if (dto.images?.length) {
          await transaction.productImage.createMany({
            data: dto.images.map((image) =>
              toImageCreateData(product.id, image),
            ),
          });
        }
        return transaction.product.findUniqueOrThrow({
          where: { id: product.id },
          include: productInclude,
        });
      });
    } catch (error) {
      throwProductConflict(error);
      throw error;
    }
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(organizationId, id);
    if (dto.brandId !== undefined || dto.categoryId !== undefined) {
      await this.validateReferences(
        organizationId,
        dto.brandId ?? undefined,
        dto.categoryId ?? undefined,
      );
    }
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined) data.slug = getValidSlug(dto.slug);
    if (dto.description !== undefined)
      data.description = dto.description.trim() || null;
    if (dto.species !== undefined) data.species = dto.species.trim() || null;
    if (dto.lifeStage !== undefined)
      data.lifeStage = dto.lifeStage.trim() || null;
    if (dto.brandId !== undefined) data.brandId = dto.brandId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.product.update({
        where: { id },
        data,
        include: productInclude,
      });
    } catch (error) {
      throwProductConflict(error);
      throw error;
    }
  }

  async deactivate(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  async createVariant(
    organizationId: string,
    productId: string,
    dto: CreateProductVariantDto,
  ) {
    await this.findOne(organizationId, productId);
    validateVariant(dto);
    try {
      return await this.prisma.productVariant.create({
        data: toVariantCreateData(organizationId, productId, dto),
      });
    } catch (error) {
      throwProductConflict(error);
      throw error;
    }
  }

  async updateVariant(
    organizationId: string,
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
  ) {
    const current = await this.prisma.productVariant.findFirst({
      where: { id: variantId, organizationId, productId },
    });
    if (!current) throw new NotFoundException('Product variant not found');

    const priceAmount = dto.priceAmount ?? Number(current.priceAmount);
    const salePriceAmount =
      dto.salePriceAmount !== undefined
        ? dto.salePriceAmount
        : current.salePriceAmount === null
          ? null
          : Number(current.salePriceAmount);
    assertValidSalePrice(priceAmount, salePriceAmount);
    const data: Prisma.ProductVariantUncheckedUpdateInput = {};
    if (dto.sku !== undefined) data.sku = normalizeSku(dto.sku);
    if (dto.name !== undefined) data.name = dto.name.trim() || null;
    if (dto.format !== undefined) data.format = dto.format.trim() || null;
    if (dto.weightGrams !== undefined) data.weightGrams = dto.weightGrams;
    if (dto.barcode !== undefined) data.barcode = dto.barcode?.trim() || null;
    if (dto.costAmount !== undefined)
      data.costAmount = toClpDecimal(dto.costAmount);
    if (dto.priceAmount !== undefined)
      data.priceAmount = toClpDecimal(dto.priceAmount);
    if (dto.salePriceAmount !== undefined)
      data.salePriceAmount =
        dto.salePriceAmount === null ? null : toClpDecimal(dto.salePriceAmount);
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one field must be provided');
    }

    try {
      return await this.prisma.productVariant.update({
        where: { id: variantId },
        data,
      });
    } catch (error) {
      throwProductConflict(error);
      throw error;
    }
  }

  async replaceImages(
    organizationId: string,
    productId: string,
    images: ProductImageDto[],
  ) {
    await this.findOne(organizationId, productId);
    validateImageCollection(images);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.productImage.deleteMany({ where: { productId } });
      if (images.length) {
        await transaction.productImage.createMany({
          data: images.map((image) => toImageCreateData(productId, image)),
        });
      }
    });
    return this.findOne(organizationId, productId);
  }

  private async validateReferences(
    organizationId: string,
    brandId: string | undefined,
    categoryId: string | undefined,
  ) {
    const brand = brandId
      ? await this.prisma.brand.findFirst({
          where: { active: true, id: brandId, organizationId },
          select: { id: true },
        })
      : null;
    const category = categoryId
      ? await this.prisma.category.findFirst({
          where: { active: true, id: categoryId, organizationId },
          select: { id: true },
        })
      : null;
    if (brandId && !brand) throw new BadRequestException('brandId is invalid');
    if (categoryId && !category)
      throw new BadRequestException('categoryId is invalid');
  }
}

function toVariantCreateData(
  organizationId: string,
  productId: string,
  dto: CreateProductVariantDto,
): Prisma.ProductVariantUncheckedCreateInput {
  validateVariant(dto);
  return {
    active: dto.active ?? true,
    barcode: normalizeOptionalText(dto.barcode),
    costAmount: toClpDecimal(dto.costAmount),
    format: normalizeOptionalText(dto.format),
    name: normalizeOptionalText(dto.name),
    organizationId,
    priceAmount: toClpDecimal(dto.priceAmount),
    productId,
    salePriceAmount:
      dto.salePriceAmount === undefined
        ? null
        : toClpDecimal(dto.salePriceAmount),
    sku: normalizeSku(dto.sku),
    weightGrams: dto.weightGrams,
  };
}

function toImageCreateData(productId: string, dto: ProductImageDto) {
  return {
    altText: normalizeOptionalText(dto.altText),
    productId,
    sortOrder: dto.sortOrder,
    url: dto.url.trim(),
  };
}

function validateVariant(dto: CreateProductVariantDto) {
  toClpDecimal(dto.costAmount);
  toClpDecimal(dto.priceAmount);
  assertValidSalePrice(dto.priceAmount, dto.salePriceAmount);
}

function validateVariantCollection(variants: CreateProductVariantDto[]) {
  const skus = variants.map(({ sku }) => normalizeSku(sku));
  const barcodes = variants
    .map(({ barcode }) => normalizeOptionalText(barcode))
    .filter((barcode): barcode is string => Boolean(barcode));
  if (new Set(skus).size !== skus.length) {
    throw new BadRequestException('Variant SKUs must be unique');
  }
  if (new Set(barcodes).size !== barcodes.length) {
    throw new BadRequestException('Variant barcodes must be unique');
  }
  variants.forEach(validateVariant);
}

function validateImageCollection(images: ProductImageDto[]) {
  const urls = images.map(({ url }) => url.trim());
  if (new Set(urls).size !== urls.length) {
    throw new BadRequestException('Product image URLs must be unique');
  }
}

function normalizeSku(value: string) {
  return value.trim().toUpperCase();
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() || undefined;
}

function throwProductConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(
      'Product slug, SKU, barcode or image URL is already in use',
    );
  }
}
