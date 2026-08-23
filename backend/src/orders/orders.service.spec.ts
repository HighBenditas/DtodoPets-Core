import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  InventoryMovementType,
  InventoryReservationStatus,
  OrderStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    inventoryBalance: { update: jest.fn() },
    inventoryMovement: { create: jest.fn() },
    inventoryReservation: { create: jest.fn(), update: jest.fn() },
    order: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    orderStatusHistory: { create: jest.fn() },
  };
}

function customer() {
  return {
    active: true,
    createdAt: new Date(),
    email: 'cliente@example.com',
    id: 'customer-a',
    name: 'Cliente Demo',
    notes: null,
    organizationId: 'org-a',
    phone: '+56912345678',
    rut: '12345678-5',
    updatedAt: new Date(),
  };
}

function address() {
  return {
    active: true,
    addressLine1: 'Av. Siempre Viva 123',
    addressLine2: null,
    city: 'Santiago',
    commune: 'Providencia',
    createdAt: new Date(),
    customerId: 'customer-a',
    id: 'address-a',
    instructions: null,
    isDefault: true,
    label: 'Casa',
    organizationId: 'org-a',
    phone: null,
    postalCode: null,
    recipientName: 'Cliente Demo',
    region: 'Metropolitana',
    updatedAt: new Date(),
  };
}

function lockedBalance(physicalQuantity = 10, reservedQuantity = 0) {
  return {
    id: 'balance-a',
    organizationId: 'org-a',
    physicalQuantity,
    reservedQuantity,
    variantId: 'variant-a',
    warehouseId: 'warehouse-a',
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findFirst: jest.Mock };
    customerAddress: { findFirst: jest.Mock };
    inventoryBalance: { upsert: jest.Mock };
    order: { count: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    productVariant: { findMany: jest.Mock };
    warehouse: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      customer: { findFirst: jest.fn() },
      customerAddress: { findFirst: jest.fn() },
      inventoryBalance: { upsert: jest.fn() },
      order: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      productVariant: { findMany: jest.fn() },
      warehouse: { findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OrdersService);
  });

  it('does not expose an order from another tenant', async () => {
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(service.findOne('org-a', 'order-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-b', organizationId: 'org-a' },
      }),
    );
  });

  it('rejects duplicate variants before querying business references', async () => {
    await expect(
      service.create('org-a', 'user-a', {
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        items: [
          { quantity: 1, variantId: 'variant-a' },
          { quantity: 2, variantId: 'variant-a' },
        ],
        warehouseId: 'warehouse-a',
      }),
    ).rejects.toThrow('Order variants must be unique');
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an incomplete storefront source before querying references', async () => {
    await expect(
      service.create(
        'org-a',
        'user-a',
        {
          customerAddressId: 'address-a',
          customerId: 'customer-a',
          items: [{ quantity: 1, variantId: 'variant-a' }],
          warehouseId: 'warehouse-a',
        },
        { requestHash: 'a'.repeat(64), storefrontCartId: '' },
      ),
    ).rejects.toThrow('Order source context is invalid');
    expect(prisma.customer.findFirst).not.toHaveBeenCalled();
  });

  it('calculates exact totals and reserves inventory in the order transaction', async () => {
    const transaction = transactionMock();
    let orderData: Prisma.OrderUncheckedCreateInput | undefined;
    let movementData: Prisma.InventoryMovementUncheckedCreateInput | undefined;
    prisma.customer.findFirst.mockResolvedValue(customer());
    prisma.customerAddress.findFirst.mockResolvedValue(address());
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse-a' });
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant-a',
        name: 'Bolsa 3 kg',
        priceAmount: new Prisma.Decimal(1200),
        product: { name: 'Alimento' },
        salePriceAmount: new Prisma.Decimal(1000),
        sku: 'SKU-A',
      },
    ]);
    prisma.inventoryBalance.upsert.mockResolvedValue({
      id: 'balance-a',
      variantId: 'variant-a',
    });
    transaction.$queryRaw.mockResolvedValue([lockedBalance()]);
    transaction.order.create.mockImplementation(
      (input: { data: Prisma.OrderUncheckedCreateInput }) => {
        orderData = input.data;
        return Promise.resolve({ id: 'order-a', number: input.data.number });
      },
    );
    transaction.orderItem.create.mockResolvedValue({ id: 'item-a' });
    transaction.inventoryReservation.create.mockResolvedValue({
      id: 'reservation-a',
    });
    transaction.inventoryMovement.create.mockImplementation(
      (input: { data: Prisma.InventoryMovementUncheckedCreateInput }) => {
        movementData = input.data;
        return Promise.resolve({ id: 'movement-a' });
      },
    );
    transaction.order.findUniqueOrThrow.mockResolvedValue({ id: 'order-a' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const beforeCreate = jest.fn().mockResolvedValue(undefined);
    const afterCreate = jest.fn().mockResolvedValue(undefined);
    await service.create(
      'org-a',
      'user-a',
      {
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        discountAmount: 200,
        items: [{ discountAmount: 100, quantity: 2, variantId: 'variant-a' }],
        shippingAmount: 500,
        warehouseId: 'warehouse-a',
      },
      { requestHash: 'a'.repeat(64), storefrontCartId: 'cart-a' },
      { afterCreate, beforeCreate },
    );

    expect(orderData).toMatchObject({
      createdByUserId: 'user-a',
      customerId: 'customer-a',
      discountAmount: new Prisma.Decimal(300),
      organizationId: 'org-a',
      shippingAmount: new Prisma.Decimal(500),
      sourceRequestHash: 'a'.repeat(64),
      storefrontCartId: 'cart-a',
      subtotalAmount: new Prisma.Decimal(2000),
      totalAmount: new Prisma.Decimal(2200),
    });
    expect(beforeCreate).toHaveBeenCalledWith(transaction);
    expect(afterCreate).toHaveBeenCalledWith(transaction, 'order-a');
    expect(transaction.inventoryBalance.update).toHaveBeenCalledWith({
      data: { reservedQuantity: 2 },
      where: { id: 'balance-a' },
    });
    expect(movementData).toMatchObject({
      physicalDelta: 0,
      reservedAfter: 2,
      reservedBefore: 0,
      reservedDelta: 2,
      type: InventoryMovementType.RESERVATION,
    });
  });

  it('rolls back order creation when available inventory is insufficient', async () => {
    const transaction = transactionMock();
    prisma.customer.findFirst.mockResolvedValue(customer());
    prisma.customerAddress.findFirst.mockResolvedValue(address());
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse-a' });
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 'variant-a',
        name: null,
        priceAmount: new Prisma.Decimal(1000),
        product: { name: 'Alimento' },
        salePriceAmount: null,
        sku: 'SKU-A',
      },
    ]);
    prisma.inventoryBalance.upsert.mockResolvedValue({
      id: 'balance-a',
      variantId: 'variant-a',
    });
    transaction.$queryRaw.mockResolvedValue([lockedBalance(1, 0)]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.create('org-a', 'user-a', {
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        items: [{ quantity: 2, variantId: 'variant-a' }],
        warehouseId: 'warehouse-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.order.create).not.toHaveBeenCalled();
  });

  it('confirms a pending order by consuming physical and reserved stock', async () => {
    const transaction = transactionMock();
    let movementData: Prisma.InventoryMovementUncheckedCreateInput | undefined;
    let consumedReservation:
      Prisma.InventoryReservationUncheckedUpdateInput | undefined;
    transaction.$queryRaw
      .mockResolvedValueOnce([
        { id: 'order-a', organizationId: 'org-a', status: OrderStatus.PENDING },
      ])
      .mockResolvedValueOnce([lockedBalance(10, 2)]);
    transaction.orderItem.findMany.mockResolvedValue([
      {
        inventoryReservation: {
          balanceId: 'balance-a',
          id: 'reservation-a',
          quantity: 2,
          status: InventoryReservationStatus.ACTIVE,
        },
      },
    ]);
    transaction.inventoryMovement.create.mockImplementation(
      (input: { data: Prisma.InventoryMovementUncheckedCreateInput }) => {
        movementData = input.data;
        return Promise.resolve({ id: 'movement-a' });
      },
    );
    transaction.inventoryReservation.update.mockImplementation(
      (input: { data: Prisma.InventoryReservationUncheckedUpdateInput }) => {
        consumedReservation = input.data;
        return Promise.resolve({ id: 'reservation-a' });
      },
    );
    transaction.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order-a',
      status: OrderStatus.CONFIRMED,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.confirm('org-a', 'user-a', 'order-a', {
      reason: 'Pago aprobado',
    });

    expect(transaction.inventoryBalance.update).toHaveBeenCalledWith({
      data: { physicalQuantity: 8, reservedQuantity: 0 },
      where: { id: 'balance-a' },
    });
    expect(consumedReservation).toMatchObject({
      consumeReason: 'Pago aprobado',
      consumedByUserId: 'user-a',
      status: InventoryReservationStatus.CONSUMED,
    });
    expect(movementData).toMatchObject({
      physicalDelta: -2,
      reservedDelta: -2,
      type: InventoryMovementType.COMMIT,
    });
    expect(result.idempotent).toBe(false);
  });

  it('cancels a pending order by releasing its reservation', async () => {
    const transaction = transactionMock();
    let movementData: Prisma.InventoryMovementUncheckedCreateInput | undefined;
    transaction.$queryRaw
      .mockResolvedValueOnce([
        { id: 'order-a', organizationId: 'org-a', status: OrderStatus.PENDING },
      ])
      .mockResolvedValueOnce([lockedBalance(10, 2)]);
    transaction.orderItem.findMany.mockResolvedValue([
      {
        inventoryReservation: {
          balanceId: 'balance-a',
          id: 'reservation-a',
          quantity: 2,
          status: InventoryReservationStatus.ACTIVE,
        },
      },
    ]);
    transaction.inventoryMovement.create.mockImplementation(
      (input: { data: Prisma.InventoryMovementUncheckedCreateInput }) => {
        movementData = input.data;
        return Promise.resolve({ id: 'movement-a' });
      },
    );
    transaction.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order-a',
      status: OrderStatus.CANCELLED,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.cancel('org-a', 'user-a', 'order-a', {
      reason: 'Cliente desistió',
    });

    expect(transaction.inventoryBalance.update).toHaveBeenCalledWith({
      data: { reservedQuantity: 0 },
      where: { id: 'balance-a' },
    });
    expect(movementData).toMatchObject({
      physicalDelta: 0,
      reservedDelta: -2,
      type: InventoryMovementType.RELEASE,
    });
    expect(result.idempotent).toBe(false);
  });

  it('replays confirmation without consuming inventory twice', async () => {
    const transaction = transactionMock();
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', organizationId: 'org-a', status: OrderStatus.CONFIRMED },
    ]);
    transaction.order.findUniqueOrThrow.mockResolvedValue({
      id: 'order-a',
      status: OrderStatus.CONFIRMED,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.confirm('org-a', 'user-a', 'order-a', {
      reason: 'Replay',
    });

    expect(result.idempotent).toBe(true);
    expect(transaction.inventoryBalance.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
