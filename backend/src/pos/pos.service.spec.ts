import { ConflictException } from '@nestjs/common';
import {
  InventoryMovementType,
  PaymentMethod,
  Prisma,
} from '../generated/prisma/client';
import { PosService } from './pos.service';

describe('PosService', () => {
  function setup() {
    const completedOrder = {
      checkoutRequestHash: 'hash-set-by-test',
      id: 'order-a',
      items: [],
      number: 'POS-20260828-ABCDEF12',
      payments: [],
      salesChannel: {
        id: 'channel-a',
        key: 'pos-sucursal',
        name: 'Venta en sucursal',
      },
      totalAmount: new Prisma.Decimal(2000),
      warehouse: { id: 'warehouse-a', name: 'Bodega principal' },
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'balance-a',
          physicalQuantity: 10,
          reservedQuantity: 0,
          variantId: '11111111-1111-4111-8111-111111111111',
        },
      ]),
      domainEvent: { create: jest.fn() },
      inventoryBalance: {
        update: jest.fn(),
        upsert: jest.fn().mockResolvedValue({
          id: 'balance-a',
          variantId: '11111111-1111-4111-8111-111111111111',
        }),
      },
      inventoryMovement: { create: jest.fn() },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order-a' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(completedOrder),
      },
      orderItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-a' }),
      },
      orderStatusHistory: { create: jest.fn() },
      payment: { create: jest.fn() },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: null,
            priceAmount: new Prisma.Decimal(2000),
            product: { name: 'Producto POS' },
            salePriceAmount: null,
            sku: '7800000000001',
          },
        ]),
      },
      salesChannel: {
        upsert: jest.fn().mockResolvedValue({ id: 'channel-a' }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'warehouse-a',
          name: 'Bodega principal',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      warehouse: { findFirst: jest.fn() },
      inventoryBalance: { findMany: jest.fn() },
    };
    return {
      completedOrder,
      prisma,
      service: new PosService(prisma as never),
      tx,
    };
  }

  it('confirms a paid walk-in sale and consumes stock in one transaction', async () => {
    const { service, tx } = setup();

    const result = await service.sell('org-a', 'user-a', {
      idempotencyKey: 'sale-a',
      items: [
        {
          quantity: 1,
          variantId: '11111111-1111-4111-8111-111111111111',
        },
      ],
      payments: [
        {
          amount: 2000,
          method: PaymentMethod.CASH,
          provider: 'Caja',
          tenderedAmount: 5000,
        },
      ],
      warehouseId: '22222222-2222-4222-8222-222222222222',
    });

    expect(result).toMatchObject({ cashChangeAmount: 3000, idempotent: false });
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CONFIRMED',
          totalAmount: new Prisma.Decimal(2000),
        }) as object,
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          physicalAfter: 9,
          physicalDelta: -1,
          reservedAfter: 0,
          reservedBefore: 0,
          reservedDelta: 0,
          type: InventoryMovementType.SALE,
        }) as object,
      }),
    );
    expect(tx.payment.create).toHaveBeenCalled();
    expect(tx.domainEvent.create).toHaveBeenCalled();
  });

  it('sells only unreserved units and preserves reservations made by other orders', async () => {
    const { service, tx } = setup();
    tx.$queryRaw.mockResolvedValue([
      {
        id: 'balance-a',
        physicalQuantity: 10,
        reservedQuantity: 8,
        variantId: '11111111-1111-4111-8111-111111111111',
      },
    ]);
    const input = {
      idempotencyKey: 'sale-with-reservations',
      items: [
        { quantity: 1, variantId: '11111111-1111-4111-8111-111111111111' },
      ],
      payments: [
        { amount: 2000, method: PaymentMethod.CASH, provider: 'Caja' },
      ],
      warehouseId: '22222222-2222-4222-8222-222222222222',
    };
    await service.sell('org-a', 'user-a', input);
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        physicalAfter: 9,
        reservedBefore: 8,
        reservedAfter: 8,
        reservedDelta: 0,
        type: InventoryMovementType.SALE,
      }) as object,
    });
    await expect(
      service.sell('org-a', 'user-a', {
        ...input,
        items: [{ ...input.items[0], quantity: 3 }],
        payments: [{ ...input.payments[0], amount: 6000 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a replay key used with a different payload', async () => {
    const { completedOrder, prisma, service } = setup();
    prisma.order.findUnique.mockResolvedValue({
      ...completedOrder,
      checkoutRequestHash: 'different-hash',
    });

    await expect(
      service.sell('org-a', 'user-a', {
        idempotencyKey: 'sale-a',
        items: [
          {
            quantity: 1,
            variantId: '11111111-1111-4111-8111-111111111111',
          },
        ],
        payments: [
          { amount: 2000, method: PaymentMethod.CASH, provider: 'Caja' },
        ],
        warehouseId: '22222222-2222-4222-8222-222222222222',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
