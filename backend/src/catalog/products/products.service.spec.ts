import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    $transaction: jest.Mock;
    brand: { findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
    product: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    productImage: { createMany: jest.Mock; deleteMany: jest.Mock };
    productVariant: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      brand: { findFirst: jest.fn() },
      category: { findFirst: jest.fn() },
      product: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      productImage: { createMany: jest.fn(), deleteMany: jest.fn() },
      productVariant: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  it('does not expose a product from another tenant', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOne('org-a', 'product-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-b', organizationId: 'org-a' },
      }),
    );
  });

  it('rejects catalog references from another tenant', async () => {
    prisma.brand.findFirst.mockResolvedValue(null);

    await expect(
      service.create('org-a', {
        brandId: 'brand-b',
        name: 'Alimento',
        variants: [{ costAmount: 1000, priceAmount: 2000, sku: 'SKU-1' }],
      }),
    ).rejects.toThrow('brandId is invalid');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate normalized SKUs before opening a transaction', async () => {
    await expect(
      service.create('org-a', {
        name: 'Alimento',
        variants: [
          { costAmount: 1000, priceAmount: 2000, sku: 'sku-1' },
          { costAmount: 1200, priceAmount: 2200, sku: ' SKU-1 ' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stores CLP amounts as exact decimals inside the atomic product creation', async () => {
    let createdVariants: Prisma.ProductVariantCreateManyInput[] = [];
    const transaction = {
      product: {
        create: jest.fn().mockResolvedValue({ id: 'product-id' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'product-id' }),
      },
      productImage: { createMany: jest.fn() },
      productVariant: {
        createMany: jest.fn(
          (input: { data: Prisma.ProductVariantCreateManyInput[] }) => {
            createdVariants = input.data;
            return Promise.resolve({ count: input.data.length });
          },
        ),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await service.create('org-a', {
      name: ' Alimento Adulto ',
      variants: [
        {
          costAmount: 1234,
          priceAmount: 2490,
          salePriceAmount: 1990,
          sku: ' food-1 ',
        },
      ],
    });

    const variantData = createdVariants[0];
    expect(variantData).toMatchObject({
      costAmount: new Prisma.Decimal(1234),
      organizationId: 'org-a',
      priceAmount: new Prisma.Decimal(2490),
      productId: 'product-id',
      salePriceAmount: new Prisma.Decimal(1990),
      sku: 'FOOD-1',
    });
  });

  it('rejects a sale price above the regular price', async () => {
    await expect(
      service.create('org-a', {
        name: 'Alimento',
        variants: [
          {
            costAmount: 1000,
            priceAmount: 2000,
            salePriceAmount: 2500,
            sku: 'SKU-1',
          },
        ],
      }),
    ).rejects.toThrow('salePriceAmount cannot exceed priceAmount');
  });
});
