import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CartStatus, OrderStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

function orderGroup(
  status: OrderStatus,
  count: number,
  values: {
    discountAmount: number;
    shippingAmount: number;
    subtotalAmount: number;
    totalAmount: number;
  },
) {
  return {
    _count: { _all: count },
    _sum: {
      discountAmount: new Prisma.Decimal(values.discountAmount),
      shippingAmount: new Prisma.Decimal(values.shippingAmount),
      subtotalAmount: new Prisma.Decimal(values.subtotalAmount),
      totalAmount: new Prisma.Decimal(values.totalAmount),
    },
    status,
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: {
    $queryRaw: jest.Mock;
    cart: { groupBy: jest.Mock };
    customer: { count: jest.Mock };
    inventoryBalance: { aggregate: jest.Mock };
    order: { groupBy: jest.Mock };
    payment: { aggregate: jest.Mock };
    paymentRefund: { aggregate: jest.Mock };
    promotionRedemption: { aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      cart: { groupBy: jest.fn() },
      customer: { count: jest.fn() },
      inventoryBalance: { aggregate: jest.fn() },
      order: { groupBy: jest.fn() },
      payment: { aggregate: jest.fn() },
      paymentRefund: { aggregate: jest.fn() },
      promotionRedemption: { aggregate: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReportsService);
  });

  it('returns exact tenant-scoped overview KPIs for the requested range', async () => {
    prisma.order.groupBy.mockResolvedValue([
      orderGroup(OrderStatus.PENDING, 2, {
        discountAmount: 0,
        shippingAmount: 0,
        subtotalAmount: 2000,
        totalAmount: 2000,
      }),
      orderGroup(OrderStatus.CONFIRMED, 2, {
        discountAmount: 200,
        shippingAmount: 500,
        subtotalAmount: 2500,
        totalAmount: 2800,
      }),
      orderGroup(OrderStatus.COMPLETED, 1, {
        discountAmount: 0,
        shippingAmount: 0,
        subtotalAmount: 1000,
        totalAmount: 1000,
      }),
      orderGroup(OrderStatus.CANCELLED, 1, {
        discountAmount: 0,
        shippingAmount: 0,
        subtotalAmount: 900,
        totalAmount: 900,
      }),
    ]);
    prisma.customer.count.mockResolvedValueOnce(9).mockResolvedValueOnce(3);
    prisma.inventoryBalance.aggregate.mockResolvedValue({
      _sum: { physicalQuantity: 100, reservedQuantity: 12 },
    });
    prisma.payment.aggregate.mockResolvedValue({
      _count: { _all: 4 },
      _sum: { amount: new Prisma.Decimal(4000) },
    });
    prisma.paymentRefund.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { amount: new Prisma.Decimal(500) },
    });
    prisma.cart.groupBy.mockResolvedValue([
      { _count: { _all: 4 }, status: CartStatus.ACTIVE },
      { _count: { _all: 3 }, status: CartStatus.CHECKED_OUT },
    ]);
    prisma.promotionRedemption.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { discountAmount: new Prisma.Decimal(300) },
    });

    const result = await service.overview('org-a', {
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-09-01T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      currency: 'CLP',
      period: {
        from: '2026-08-01T00:00:00.000Z',
        timeZone: 'UTC',
        to: '2026-09-01T00:00:00.000Z',
      },
      sales: {
        averageOrderValueAmount: '1267',
        discountAmount: '200',
        orderCount: 3,
        shippingAmount: '500',
        subtotalAmount: '3500',
        totalAmount: '3800',
      },
      orders: {
        byStatus: {
          CANCELLED: 1,
          COMPLETED: 1,
          CONFIRMED: 2,
          PENDING: 2,
        },
        total: 6,
      },
      customers: { active: 9, createdInPeriod: 3 },
      inventory: {
        availableQuantity: 88,
        physicalQuantity: 100,
        reservedQuantity: 12,
      },
      payments: {
        capturedAmount: '4000',
        netAmount: '3500',
        paymentCount: 4,
        refundCount: 1,
        refundedAmount: '500',
      },
      carts: {
        byStatus: {
          ABANDONED: 0,
          ACTIVE: 4,
          CHECKED_OUT: 3,
          EXPIRED: 0,
        },
        total: 7,
      },
      promotions: { discountAmount: '300', redemptionCount: 2 },
    });
    const expectedRange = {
      gte: new Date('2026-08-01T00:00:00.000Z'),
      lt: new Date('2026-09-01T00:00:00.000Z'),
    };
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: expectedRange, organizationId: 'org-a' },
      }),
    );
    expect(prisma.inventoryBalance.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-a' } }),
    );
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: expectedRange, organizationId: 'org-a' },
      }),
    );
    expect(prisma.paymentRefund.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: expectedRange, organizationId: 'org-a' },
      }),
    );
    expect(prisma.promotionRedemption.aggregate).toHaveBeenCalledWith({
      _count: { _all: true },
      _sum: { discountAmount: true },
      where: {
        createdAt: expectedRange,
        organizationId: 'org-a',
        order: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.COMPLETED] },
        },
      },
    });
  });

  it('rejects inverted and overlong ranges before querying data', async () => {
    await expect(
      service.overview('org-a', {
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.dailySales('org-a', {
        from: '2025-01-01T00:00:00.000Z',
        limit: 20,
        page: 1,
        to: '2026-08-01T00:00:00.000Z',
      }),
    ).rejects.toThrow('Report range cannot exceed 366 days');
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns parameterized tenant-scoped daily sales with exact pagination', async () => {
    const sqlQueries: Prisma.Sql[] = [];
    prisma.$queryRaw.mockImplementation((query: Prisma.Sql) => {
      sqlQueries.push(query);
      return Promise.resolve(
        sqlQueries.length === 1
          ? [
              {
                date: '2026-08-20',
                discountAmount: '199',
                orderCount: 2,
                shippingAmount: '500',
                subtotalAmount: '2700',
                totalAmount: '3001',
              },
            ]
          : [{ dayCount: 2 }],
      );
    });

    const result = await service.dailySales('org-a', {
      from: '2026-08-01T00:00:00.000Z',
      limit: 1,
      page: 2,
      to: '2026-09-01T00:00:00.000Z',
    });

    expect(result).toEqual({
      currency: 'CLP',
      data: [
        {
          averageOrderValueAmount: '1501',
          date: '2026-08-20',
          discountAmount: '199',
          orderCount: 2,
          shippingAmount: '500',
          subtotalAmount: '2700',
          totalAmount: '3001',
        },
      ],
      meta: { limit: 1, page: 2, pageCount: 2, total: 2 },
      period: {
        from: '2026-08-01T00:00:00.000Z',
        timeZone: 'UTC',
        to: '2026-09-01T00:00:00.000Z',
      },
    });
    const [listQuery, countQuery] = sqlQueries;
    expect(listQuery).toBeDefined();
    expect(countQuery).toBeDefined();
    if (!listQuery || !countQuery) throw new Error('Expected report queries');
    expect(listQuery.sql).not.toContain('org-a');
    expect(listQuery.sql).toContain('OFFSET');
    expect(listQuery.values).toEqual(
      expect.arrayContaining([
        'org-a',
        OrderStatus.CONFIRMED,
        OrderStatus.COMPLETED,
        '2026-08-01T00:00:00.000Z',
        '2026-09-01T00:00:00.000Z',
        1,
      ]),
    );
    expect(countQuery.sql).not.toContain('org-a');
    expect(countQuery.values).toEqual(
      expect.arrayContaining([
        'org-a',
        OrderStatus.CONFIRMED,
        OrderStatus.COMPLETED,
      ]),
    );
  });
});
