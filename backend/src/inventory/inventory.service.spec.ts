import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

function balance(id: string, warehouseId = 'warehouse-a') {
  return {
    createdAt: new Date('2026-08-22T00:00:00.000Z'),
    id,
    organizationId: 'org-a',
    physicalQuantity: 10,
    reservedQuantity: 2,
    updatedAt: new Date('2026-08-22T00:00:00.000Z'),
    variant: {
      active: true,
      barcode: null,
      id: 'variant-a',
      name: 'Bolsa 3 kg',
      product: {
        active: true,
        id: 'product-a',
        name: 'Alimento',
        slug: 'alimento',
      },
      sku: 'SKU-A',
    },
    variantId: 'variant-a',
    warehouse: { active: true, id: warehouseId, name: warehouseId },
    warehouseId,
  };
}

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    inventoryBalance: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: { create: jest.fn() },
    inventoryReservation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    $transaction: jest.Mock;
    inventoryBalance: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
    };
    inventoryMovement: { count: jest.Mock; findMany: jest.Mock };
    inventoryReservation: { count: jest.Mock; findMany: jest.Mock };
    productVariant: { findFirst: jest.Mock };
    warehouse: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      inventoryBalance: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      inventoryMovement: { count: jest.fn(), findMany: jest.fn() },
      inventoryReservation: { count: jest.fn(), findMany: jest.fn() },
      productVariant: { findFirst: jest.fn() },
      warehouse: { findFirst: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(InventoryService);
  });

  it('does not expose a balance from another tenant', async () => {
    prisma.inventoryBalance.findFirst.mockResolvedValue(null);

    await expect(
      service.findBalance('org-a', 'balance-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.inventoryBalance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'balance-b', organizationId: 'org-a' },
      }),
    );
  });

  it('records an adjustment with actor and before/after state', async () => {
    const transaction = transactionMock();
    let createdMovement:
      Prisma.InventoryMovementUncheckedCreateInput | undefined;
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse-a' });
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-a' });
    prisma.inventoryBalance.upsert.mockResolvedValue({ id: 'balance-a' });
    transaction.$queryRaw.mockResolvedValue([
      {
        id: 'balance-a',
        organizationId: 'org-a',
        physicalQuantity: 10,
        reservedQuantity: 2,
        variantId: 'variant-a',
        warehouseId: 'warehouse-a',
      },
    ]);
    transaction.inventoryMovement.create.mockImplementation(
      (input: { data: Prisma.InventoryMovementUncheckedCreateInput }) => {
        createdMovement = input.data;
        return Promise.resolve({ id: 'movement-a' });
      },
    );
    transaction.inventoryBalance.findUniqueOrThrow.mockResolvedValue({
      ...balance('balance-a'),
      physicalQuantity: 15,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.adjust('org-a', 'user-a', {
      quantityDelta: 5,
      reason: ' Recepción de compra ',
      variantId: 'variant-a',
      warehouseId: 'warehouse-a',
    });

    expect(transaction.inventoryBalance.update).toHaveBeenCalledWith({
      data: { physicalQuantity: 15, reservedQuantity: 2 },
      where: { id: 'balance-a' },
    });
    expect(createdMovement).toMatchObject({
      actorUserId: 'user-a',
      organizationId: 'org-a',
      physicalAfter: 15,
      physicalBefore: 10,
      physicalDelta: 5,
      reason: 'Recepción de compra',
      reservedAfter: 2,
      reservedBefore: 2,
      type: InventoryMovementType.ADJUSTMENT,
    });
    expect(result.balance.availableQuantity).toBe(13);
  });

  it('rejects a reduction that would consume reserved stock', async () => {
    const transaction = transactionMock();
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse-a' });
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-a' });
    prisma.inventoryBalance.upsert.mockResolvedValue({ id: 'balance-a' });
    transaction.$queryRaw.mockResolvedValue([
      {
        id: 'balance-a',
        organizationId: 'org-a',
        physicalQuantity: 5,
        reservedQuantity: 3,
        variantId: 'variant-a',
        warehouseId: 'warehouse-a',
      },
    ]);
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.adjust('org-a', 'user-a', {
        quantityDelta: -3,
        reason: 'Merma',
        variantId: 'variant-a',
        warehouseId: 'warehouse-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.inventoryBalance.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('creates symmetric transfer movements under one operation', async () => {
    const transaction = transactionMock();
    const createdMovements: Prisma.InventoryMovementUncheckedCreateInput[] = [];
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse' });
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-a' });
    prisma.inventoryBalance.upsert
      .mockResolvedValueOnce({ id: 'balance-source' })
      .mockResolvedValueOnce({ id: 'balance-destination' });
    transaction.$queryRaw.mockResolvedValue([
      {
        id: 'balance-destination',
        organizationId: 'org-a',
        physicalQuantity: 1,
        reservedQuantity: 0,
        variantId: 'variant-a',
        warehouseId: 'warehouse-b',
      },
      {
        id: 'balance-source',
        organizationId: 'org-a',
        physicalQuantity: 10,
        reservedQuantity: 2,
        variantId: 'variant-a',
        warehouseId: 'warehouse-a',
      },
    ]);
    transaction.inventoryMovement.create.mockImplementation(
      (input: { data: Prisma.InventoryMovementUncheckedCreateInput }) => {
        createdMovements.push(input.data);
        return Promise.resolve({ id: `movement-${createdMovements.length}` });
      },
    );
    transaction.inventoryBalance.findUniqueOrThrow.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          where.id === 'balance-source'
            ? { ...balance(where.id), physicalQuantity: 7 }
            : {
                ...balance(where.id, 'warehouse-b'),
                physicalQuantity: 4,
                reservedQuantity: 0,
              },
        ),
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.transfer('org-a', 'user-a', {
      destinationWarehouseId: 'warehouse-b',
      quantity: 3,
      reason: 'Reposición',
      sourceWarehouseId: 'warehouse-a',
      variantId: 'variant-a',
    });

    expect(createdMovements[0]).toMatchObject({
      physicalDelta: -3,
      type: InventoryMovementType.TRANSFER_OUT,
    });
    expect(createdMovements[1]).toMatchObject({
      physicalDelta: 3,
      type: InventoryMovementType.TRANSFER_IN,
    });
    expect(result.movements).toHaveLength(2);
    expect(result.source.availableQuantity).toBe(5);
    expect(result.destination.availableQuantity).toBe(4);
  });

  it('replays a referenced reservation without changing stock twice', async () => {
    const transaction = transactionMock();
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'warehouse-a' });
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-a' });
    prisma.inventoryBalance.upsert.mockResolvedValue({ id: 'balance-a' });
    transaction.$queryRaw.mockResolvedValue([
      {
        id: 'balance-a',
        organizationId: 'org-a',
        physicalQuantity: 10,
        reservedQuantity: 2,
        variantId: 'variant-a',
        warehouseId: 'warehouse-a',
      },
    ]);
    transaction.inventoryReservation.findFirst.mockResolvedValue({
      balance: balance('balance-a'),
      id: 'reservation-a',
      quantity: 3,
      status: InventoryReservationStatus.ACTIVE,
    });
    transaction.inventoryBalance.findUniqueOrThrow.mockResolvedValue(
      balance('balance-a'),
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.reserve('org-a', 'user-a', {
      quantity: 3,
      reason: 'Pedido',
      referenceId: 'order-100',
      referenceType: 'order',
      variantId: 'variant-a',
      warehouseId: 'warehouse-a',
    });

    expect(result.idempotent).toBe(true);
    expect(transaction.inventoryBalance.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('replays an already released reservation without another movement', async () => {
    const transaction = transactionMock();
    transaction.$queryRaw.mockResolvedValue([
      {
        balanceId: 'balance-a',
        id: 'reservation-a',
        organizationId: 'org-a',
        quantity: 3,
        status: InventoryReservationStatus.RELEASED,
      },
    ]);
    transaction.inventoryBalance.findUniqueOrThrow.mockResolvedValue(
      balance('balance-a'),
    );
    transaction.inventoryReservation.findUniqueOrThrow.mockResolvedValue({
      id: 'reservation-a',
      status: InventoryReservationStatus.RELEASED,
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.release('org-a', 'user-a', 'reservation-a', {
      reason: 'Cancelación',
    });

    expect(result.idempotent).toBe(true);
    expect(transaction.inventoryBalance.update).not.toHaveBeenCalled();
    expect(transaction.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
