import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import {
  OrderStatus,
  Prisma,
  ShipmentStatus,
  ShipmentType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipmentsService } from './shipments.service';

function shipment(
  requestHash = 'a'.repeat(64),
  status: ShipmentStatus = ShipmentStatus.PENDING,
) {
  return {
    actualCostAmount: new Prisma.Decimal(0),
    cancelledAt: null,
    carrier: null,
    createdAt: new Date(),
    createdBy: {
      email: 'admin@example.com',
      firstName: 'Admin',
      id: 'user-a',
      lastName: null,
    },
    createdByUserId: 'user-a',
    currency: 'CLP',
    customerChargeAmount: new Prisma.Decimal(0),
    deliveredAt: null,
    id: 'shipment-a',
    idempotencyKey: 'shipment-key-1',
    items: [
      {
        createdAt: new Date(),
        id: 'shipment-item-a',
        orderItem: {
          id: 'order-item-a',
          nameSnapshot: 'Producto',
          quantity: 2,
          skuSnapshot: 'SKU-A',
          variantId: 'variant-a',
        },
        orderItemId: 'order-item-a',
        organizationId: 'org-a',
        quantity: 1,
        shipmentId: 'shipment-a',
      },
    ],
    notes: null,
    number: 'SHP-1',
    order: {
      customer: { id: 'customer-a', name: 'Cliente' },
      id: 'order-a',
      number: 'ORD-1',
      shippingAmount: new Prisma.Decimal(500),
      status: OrderStatus.CONFIRMED,
    },
    orderId: 'order-a',
    organizationId: 'org-a',
    readyAt: status === ShipmentStatus.PENDING ? null : new Date(),
    requestHash,
    serviceName: 'Retiro en tienda',
    shippedAt: null,
    status,
    statusHistory: [],
    trackingNumber: null,
    trackingUrl: null,
    type: ShipmentType.PICKUP,
    updatedAt: new Date(),
  };
}

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    orderItem: { findMany: jest.fn() },
    shipment: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    shipmentItem: { create: jest.fn(), groupBy: jest.fn() },
    shipmentStatusHistory: { create: jest.fn() },
  };
}

describe('ShipmentsService', () => {
  let service: ShipmentsService;
  let prisma: {
    $transaction: jest.Mock;
    shipment: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      shipment: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [
        ShipmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ShipmentsService);
  });

  it('rejects pickup tracking metadata before a transaction', async () => {
    await expect(
      service.create('org-a', 'user-a', {
        idempotencyKey: 'shipment-key-1',
        items: [{ orderItemId: 'order-item-a', quantity: 1 }],
        orderId: 'order-a',
        trackingNumber: 'TRACK-1',
        type: ShipmentType.PICKUP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a partial shipment and records its initial history', async () => {
    const transaction = transactionMock();
    prisma.shipment.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', shippingAmount: '500', status: OrderStatus.CONFIRMED },
    ]);
    transaction.shipment.findUnique.mockResolvedValue(null);
    transaction.orderItem.findMany.mockResolvedValue([
      { id: 'order-item-a', quantity: 2 },
    ]);
    transaction.shipmentItem.groupBy.mockResolvedValue([]);
    transaction.shipment.aggregate.mockResolvedValue({
      _sum: { customerChargeAmount: new Prisma.Decimal(0) },
    });
    transaction.shipment.create.mockResolvedValue({
      ...shipment(),
      createdBy: undefined,
      items: undefined,
      order: undefined,
      statusHistory: undefined,
    });
    transaction.shipment.findUniqueOrThrow.mockResolvedValue(shipment());
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.create('org-a', 'user-a', {
      customerChargeAmount: 300,
      idempotencyKey: 'shipment-key-1',
      items: [{ orderItemId: 'order-item-a', quantity: 1 }],
      orderId: 'order-a',
      serviceName: 'Retiro en tienda',
      type: ShipmentType.PICKUP,
    });

    expect(result.idempotent).toBe(false);
    expect(transaction.shipment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actualCostAmount: new Prisma.Decimal(0),
        customerChargeAmount: new Prisma.Decimal(300),
        organizationId: 'org-a',
        type: ShipmentType.PICKUP,
      }) as object,
    });
    expect(transaction.shipmentStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: ShipmentStatus.PENDING,
      }) as object,
    });
  });

  it('rejects quantities already allocated to active shipments', async () => {
    const transaction = transactionMock();
    prisma.shipment.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', shippingAmount: '500', status: OrderStatus.CONFIRMED },
    ]);
    transaction.shipment.findUnique.mockResolvedValue(null);
    transaction.orderItem.findMany.mockResolvedValue([
      { id: 'order-item-a', quantity: 2 },
    ]);
    transaction.shipmentItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 1 }, orderItemId: 'order-item-a' },
    ]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.create('org-a', 'user-a', {
        idempotencyKey: 'shipment-key-2',
        items: [{ orderItemId: 'order-item-a', quantity: 2 }],
        orderId: 'order-a',
        type: ShipmentType.OWN_DELIVERY,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects customer charge allocation above the order shipping amount', async () => {
    const transaction = transactionMock();
    prisma.shipment.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', shippingAmount: '500', status: OrderStatus.CONFIRMED },
    ]);
    transaction.shipment.findUnique.mockResolvedValue(null);
    transaction.orderItem.findMany.mockResolvedValue([
      { id: 'order-item-a', quantity: 2 },
    ]);
    transaction.shipmentItem.groupBy.mockResolvedValue([]);
    transaction.shipment.aggregate.mockResolvedValue({
      _sum: { customerChargeAmount: new Prisma.Decimal(400) },
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.create('org-a', 'user-a', {
        customerChargeAmount: 101,
        idempotencyKey: 'shipment-key-2',
        items: [{ orderItemId: 'order-item-a', quantity: 1 }],
        orderId: 'order-a',
        type: ShipmentType.OWN_DELIVERY,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('replays shipment creation only for the same normalized payload', async () => {
    const items = [{ orderItemId: 'order-item-a', quantity: 1 }];
    const requestHash = createRequestFingerprint({
      actualCostAmount: 0,
      carrier: null,
      customerChargeAmount: 0,
      items,
      notes: null,
      orderId: 'order-a',
      serviceName: 'Retiro en tienda',
      trackingNumber: null,
      trackingUrl: null,
      type: ShipmentType.PICKUP,
    });
    prisma.shipment.findUnique.mockResolvedValue(shipment(requestHash));

    const result = await service.create('org-a', 'user-a', {
      idempotencyKey: 'shipment-key-1',
      items,
      orderId: 'order-a',
      serviceName: 'Retiro en tienda',
      type: ShipmentType.PICKUP,
    });

    expect(result.idempotent).toBe(true);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('moves a pending shipment to ready and writes history', async () => {
    const transaction = transactionMock();
    prisma.shipment.findFirst.mockResolvedValue({ orderId: 'order-a' });
    transaction.$queryRaw
      .mockResolvedValueOnce([
        { id: 'order-a', shippingAmount: '500', status: OrderStatus.CONFIRMED },
      ])
      .mockResolvedValueOnce([
        {
          actualCostAmount: '0',
          cancelledAt: null,
          carrier: null,
          deliveredAt: null,
          id: 'shipment-a',
          orderId: 'order-a',
          readyAt: null,
          serviceName: 'Retiro en tienda',
          shippedAt: null,
          status: ShipmentStatus.PENDING,
          trackingNumber: null,
          trackingUrl: null,
          type: ShipmentType.PICKUP,
        },
      ]);
    transaction.shipment.update.mockResolvedValue({
      ...shipment('a'.repeat(64), ShipmentStatus.READY),
      createdBy: undefined,
      items: undefined,
      order: undefined,
      statusHistory: undefined,
    });
    transaction.shipment.findUniqueOrThrow.mockResolvedValue(
      shipment('a'.repeat(64), ShipmentStatus.READY),
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.transition('org-a', 'user-a', 'shipment-a', {
      reason: 'Pedido preparado',
      status: ShipmentStatus.READY,
    });

    expect(result.idempotent).toBe(false);
    expect(transaction.shipment.update).toHaveBeenCalledWith({
      data: expect.objectContaining({
        readyAt: expect.any(Date) as Date,
        status: ShipmentStatus.READY,
      }) as object,
      where: { id: 'shipment-a' },
    });
    expect(transaction.shipmentStatusHistory.create).toHaveBeenCalled();
  });
});
