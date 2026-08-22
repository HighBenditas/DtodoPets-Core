import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { InventoryMovementType, OrderStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsService } from './returns.service';

function orderReturn(requestHash = 'a'.repeat(64)) {
  return {
    createdAt: new Date(),
    createdBy: {
      email: 'admin@example.com',
      firstName: 'Admin',
      id: 'user-a',
      lastName: null,
    },
    createdByUserId: 'user-a',
    id: 'return-a',
    idempotencyKey: 'return-key-1',
    items: [
      {
        createdAt: new Date(),
        id: 'return-item-a',
        orderItem: {
          id: 'order-item-a',
          nameSnapshot: 'Producto',
          quantity: 2,
          skuSnapshot: 'SKU-A',
          variantId: 'variant-a',
        },
        orderItemId: 'order-item-a',
        orderReturnId: 'return-a',
        organizationId: 'org-a',
        quantity: 1,
        restocked: true,
      },
    ],
    number: 'RET-1',
    order: {
      customer: { id: 'customer-a', name: 'Cliente' },
      id: 'order-a',
      number: 'ORD-1',
      status: OrderStatus.CONFIRMED,
    },
    orderId: 'order-a',
    organizationId: 'org-a',
    reason: 'Producto cerrado',
    requestHash,
  };
}

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    inventoryBalance: { update: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    orderItem: { findMany: jest.fn() },
    orderReturn: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    orderReturnItem: {
      create: jest.fn(),
      groupBy: jest.fn(),
    },
  };
}

describe('ReturnsService', () => {
  let service: ReturnsService;
  let prisma: {
    $transaction: jest.Mock;
    orderReturn: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      orderReturn: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [ReturnsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ReturnsService);
  });

  it('rejects duplicate order items before opening a transaction', async () => {
    await expect(
      service.create('org-a', 'user-a', {
        idempotencyKey: 'return-key-1',
        items: [
          { orderItemId: 'order-item-a', quantity: 1 },
          { orderItemId: 'order-item-a', quantity: 1 },
        ],
        orderId: 'order-a',
        reason: 'Duplicado',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a partial return and optionally restocks inventory', async () => {
    const transaction = transactionMock();
    prisma.orderReturn.findUnique.mockResolvedValue(null);
    transaction.$queryRaw
      .mockResolvedValueOnce([{ id: 'order-a', status: OrderStatus.CONFIRMED }])
      .mockResolvedValueOnce([
        {
          id: 'balance-a',
          organizationId: 'org-a',
          physicalQuantity: 8,
          reservedQuantity: 0,
        },
      ]);
    transaction.orderReturn.findUnique.mockResolvedValue(null);
    transaction.orderItem.findMany.mockResolvedValue([
      {
        id: 'order-item-a',
        inventoryReservation: { balanceId: 'balance-a' },
        quantity: 2,
      },
    ]);
    transaction.orderReturnItem.groupBy.mockResolvedValue([]);
    transaction.orderReturn.create.mockResolvedValue({ id: 'return-a' });
    transaction.orderReturnItem.create.mockResolvedValue({
      id: 'return-item-a',
    });
    transaction.orderReturn.findUniqueOrThrow.mockResolvedValue(orderReturn());
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.create('org-a', 'user-a', {
      idempotencyKey: 'return-key-1',
      items: [{ orderItemId: 'order-item-a', quantity: 1, restock: true }],
      orderId: 'order-a',
      reason: 'Producto cerrado',
    });

    expect(result.idempotent).toBe(false);
    expect(transaction.inventoryBalance.update).toHaveBeenCalledWith({
      data: { physicalQuantity: 9 },
      where: { id: 'balance-a' },
    });
    expect(transaction.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        physicalDelta: 1,
        reservedDelta: 0,
        type: InventoryMovementType.RETURN,
      }) as object,
    });
  });

  it('rejects quantities above what remains returnable', async () => {
    const transaction = transactionMock();
    prisma.orderReturn.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', status: OrderStatus.CONFIRMED },
    ]);
    transaction.orderReturn.findUnique.mockResolvedValue(null);
    transaction.orderItem.findMany.mockResolvedValue([
      {
        id: 'order-item-a',
        inventoryReservation: { balanceId: 'balance-a' },
        quantity: 2,
      },
    ]);
    transaction.orderReturnItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 1 }, orderItemId: 'order-item-a' },
    ]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.create('org-a', 'user-a', {
        idempotencyKey: 'return-key-2',
        items: [{ orderItemId: 'order-item-a', quantity: 2 }],
        orderId: 'order-a',
        reason: 'Exceso',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.orderReturn.create).not.toHaveBeenCalled();
  });

  it('replays the same key independent of item order', async () => {
    const items = [{ orderItemId: 'order-item-a', quantity: 1, restock: true }];
    const requestHash = createRequestFingerprint({
      items,
      orderId: 'order-a',
      reason: 'Producto cerrado',
    });
    prisma.orderReturn.findUnique.mockResolvedValue(orderReturn(requestHash));

    const result = await service.create('org-a', 'user-a', {
      idempotencyKey: 'return-key-1',
      items,
      orderId: 'order-a',
      reason: 'Producto cerrado',
    });

    expect(result.idempotent).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
