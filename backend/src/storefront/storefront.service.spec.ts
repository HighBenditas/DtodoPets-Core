import { createHash } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { CustomersService } from '../customers/customers.service';
import { CartStatus, OrderStatus, Prisma } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { StorefrontService } from './storefront.service';

const channel = {
  createdByUserId: 'user-a',
  id: 'channel-a',
  key: 'web',
  metadata: { cartTtlHours: 12 },
  name: 'Tienda web',
  organizationId: 'org-a',
};

function cart(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-08-22T12:00:00.000Z');
  return {
    accessTokenHash: 'a'.repeat(64),
    checkedOutAt: null,
    checkoutRequestHash: null,
    createdAt: now,
    customerId: null,
    expiresAt: new Date('2099-08-23T00:00:00.000Z'),
    id: '550e8400-e29b-41d4-a716-446655440000',
    items: [],
    order: null,
    organizationId: 'org-a',
    promotion: null,
    promotionId: null,
    salesChannelId: 'channel-a',
    status: CartStatus.ACTIVE,
    updatedAt: now,
    version: 0,
    ...overrides,
  };
}

describe('StorefrontService', () => {
  let service: StorefrontService;
  let prisma: {
    cart: { create: jest.Mock; findFirst: jest.Mock };
    product: { count: jest.Mock; findMany: jest.Mock };
    salesChannel: { findFirst: jest.Mock };
  };
  let orders: { create: jest.Mock };
  let promotions: {
    findActiveAutomatic: jest.Mock;
    findActiveByCode: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      cart: { create: jest.fn(), findFirst: jest.fn() },
      product: { count: jest.fn(), findMany: jest.fn() },
      salesChannel: { findFirst: jest.fn().mockResolvedValue(channel) },
    };
    orders = { create: jest.fn() };
    promotions = {
      findActiveAutomatic: jest.fn().mockResolvedValue([]),
      findActiveByCode: jest.fn(),
    };
    const module = await Test.createTestingModule({
      providers: [
        StorefrontService,
        { provide: PrismaService, useValue: prisma },
        { provide: CustomersService, useValue: {} },
        { provide: OrdersService, useValue: orders },
        { provide: PromotionsService, useValue: promotions },
      ],
    }).compile();
    service = module.get(StorefrontService);
  });

  it('returns a random cart token but persists only its SHA-256 hash', async () => {
    let storedHash: string | undefined;
    prisma.cart.create.mockImplementation(
      (input: { data: { accessTokenHash: string } }) => {
        storedHash = input.data.accessTokenHash;
        return Promise.resolve(cart({ accessTokenHash: storedHash }));
      },
    );

    const result = await service.createCart('tenant-a', 'web');

    expect(result.cartToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(storedHash).toBe(
      createHash('sha256').update(result.cartToken).digest('hex'),
    );
    expect(storedHash).not.toContain(result.cartToken);
    expect(result.cart).not.toHaveProperty('accessTokenHash');
  });

  it('hides cart existence when the opaque token is absent', async () => {
    await expect(
      service.cart(
        'tenant-a',
        'web',
        '550e8400-e29b-41d4-a716-446655440000',
        undefined,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.cart.findFirst).not.toHaveBeenCalled();
  });

  it('aggregates public availability without returning raw balances', async () => {
    let query: Prisma.ProductFindManyArgs | undefined;
    prisma.product.findMany.mockImplementation(
      (input: Prisma.ProductFindManyArgs) => {
        query = input;
        return Promise.resolve([
          {
            brand: null,
            category: null,
            description: 'Alimento completo',
            id: 'product-a',
            images: [],
            lifeStage: 'adult',
            name: 'Alimento',
            slug: 'alimento',
            species: 'perro',
            variants: [
              {
                format: '3 kg',
                id: 'variant-a',
                inventoryBalances: [
                  { physicalQuantity: 10, reservedQuantity: 3 },
                  { physicalQuantity: 4, reservedQuantity: 1 },
                ],
                name: 'Bolsa',
                priceAmount: new Prisma.Decimal(10_000),
                salePriceAmount: null,
                sku: 'SKU-A',
                weightGrams: 3000,
              },
            ],
          },
        ]);
      },
    );
    prisma.product.count.mockResolvedValue(1);

    const result = await service.catalog('tenant-a', 'web', {
      limit: 20,
      page: 1,
    });

    expect(result.data[0].variants[0].availableQuantity).toBe(10);
    expect(result.data[0].variants[0]).not.toHaveProperty('inventoryBalances');
    expect(result.data[0].variants[0]).not.toHaveProperty('costAmount');
    expect(query?.where).toMatchObject({
      active: true,
      organizationId: 'org-a',
    });
  });

  it('replays a completed checkout without creating another order', async () => {
    const dto = {
      customer: { email: 'cliente@example.com', name: 'Cliente' },
      shippingAddress: {
        addressLine1: 'Calle 1',
        city: 'Santiago',
        commune: 'Providencia',
        region: 'Metropolitana',
      },
    };
    const requestHash = createRequestFingerprint({
      cartId: '550e8400-e29b-41d4-a716-446655440000',
      checkout: dto,
      version: 2,
    });
    prisma.cart.findFirst.mockResolvedValue(
      cart({
        checkedOutAt: new Date(),
        checkoutRequestHash: requestHash,
        customerId: 'customer-a',
        order: {
          createdAt: new Date(),
          currency: 'CLP',
          discountAmount: new Prisma.Decimal(0),
          id: 'order-a',
          items: [],
          number: 'ORD-1',
          promotionRedemptions: [],
          shippingAmount: new Prisma.Decimal(0),
          status: OrderStatus.PENDING,
          subtotalAmount: new Prisma.Decimal(10_000),
          totalAmount: new Prisma.Decimal(10_000),
        },
        status: CartStatus.CHECKED_OUT,
        version: 2,
      }),
    );

    const result = await service.checkout(
      'tenant-a',
      'web',
      '550e8400-e29b-41d4-a716-446655440000',
      'valid-token',
      dto,
    );

    expect(result).toMatchObject({
      idempotent: true,
      order: { id: 'order-a', number: 'ORD-1' },
    });
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('rejects a completed checkout replay with a different payload', async () => {
    prisma.cart.findFirst.mockResolvedValue(
      cart({
        checkedOutAt: new Date(),
        checkoutRequestHash: 'b'.repeat(64),
        customerId: 'customer-a',
        order: { id: 'order-a' },
        status: CartStatus.CHECKED_OUT,
      }),
    );

    await expect(
      service.checkout(
        'tenant-a',
        'web',
        '550e8400-e29b-41d4-a716-446655440000',
        'valid-token',
        {
          customer: { email: 'cliente@example.com', name: 'Cliente' },
          shippingAddress: {
            addressLine1: 'Calle 1',
            city: 'Santiago',
            commune: 'Providencia',
            region: 'Metropolitana',
          },
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orders.create).not.toHaveBeenCalled();
  });
});
