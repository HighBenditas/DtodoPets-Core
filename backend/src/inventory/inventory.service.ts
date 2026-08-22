import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createPage, getPagination } from '../common/pagination/pagination';
import {
  InventoryMovementType,
  InventoryReservationStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { MovementQueryDto } from './dto/movement-query.dto';
import { ReleaseReservationDto } from './dto/release-reservation.dto';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { TransferInventoryDto } from './dto/transfer-inventory.dto';

const maximumInventoryQuantity = 2_000_000_000;

const balanceInclude = {
  variant: {
    select: {
      active: true,
      barcode: true,
      id: true,
      name: true,
      product: { select: { active: true, id: true, name: true, slug: true } },
      sku: true,
    },
  },
  warehouse: { select: { active: true, id: true, name: true } },
} satisfies Prisma.InventoryBalanceInclude;

const movementInclude = {
  actor: { select: { email: true, firstName: true, id: true, lastName: true } },
  balance: { include: balanceInclude },
} satisfies Prisma.InventoryMovementInclude;

const reservationInclude = {
  balance: { include: balanceInclude },
  createdBy: {
    select: { email: true, firstName: true, id: true, lastName: true },
  },
  releasedBy: {
    select: { email: true, firstName: true, id: true, lastName: true },
  },
} satisfies Prisma.InventoryReservationInclude;

type BalanceWithRelations = Prisma.InventoryBalanceGetPayload<{
  include: typeof balanceInclude;
}>;

interface LockedBalance {
  id: string;
  organizationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  variantId: string;
  warehouseId: string;
}

interface LockedReservation {
  balanceId: string;
  id: string;
  organizationId: string;
  quantity: number;
  status: InventoryReservationStatus;
}

interface InventoryState {
  physicalAfter: number;
  reservedAfter: number;
}

interface ReferencePair {
  referenceId?: string;
  referenceType?: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findBalances(organizationId: string, query: InventoryQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.InventoryBalanceWhereInput = {
      organizationId,
      warehouseId: query.warehouseId,
      variantId: query.variantId,
      variant: query.productId
        ? { is: { productId: query.productId } }
        : undefined,
      ...(search
        ? {
            OR: [
              {
                warehouse: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                variant: {
                  is: {
                    OR: [
                      { sku: { contains: search, mode: 'insensitive' } },
                      { barcode: { contains: search, mode: 'insensitive' } },
                      {
                        product: {
                          is: {
                            name: { contains: search, mode: 'insensitive' },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [balances, total] = await this.prisma.$transaction([
      this.prisma.inventoryBalance.findMany({
        where,
        include: balanceInclude,
        ...getPagination(query),
        orderBy: [{ warehouse: { name: 'asc' } }, { variant: { sku: 'asc' } }],
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);
    return createPage(balances.map(toBalanceView), total, query);
  }

  async findBalance(organizationId: string, id: string) {
    const balance = await this.prisma.inventoryBalance.findFirst({
      where: { id, organizationId },
      include: balanceInclude,
    });
    if (!balance) throw new NotFoundException('Inventory balance not found');
    return toBalanceView(balance);
  }

  async findMovements(organizationId: string, query: MovementQueryDto) {
    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
      operationId: query.operationId,
      type: query.type,
      referenceType: query.referenceType?.trim(),
      referenceId: query.referenceId?.trim(),
      balance:
        query.warehouseId || query.variantId
          ? {
              is: {
                warehouseId: query.warehouseId,
                variantId: query.variantId,
              },
            }
          : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findReservations(organizationId: string, query: ReservationQueryDto) {
    const where: Prisma.InventoryReservationWhereInput = {
      organizationId,
      status: query.status,
      balance:
        query.warehouseId || query.variantId
          ? {
              is: {
                warehouseId: query.warehouseId,
                variantId: query.variantId,
              },
            }
          : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryReservation.findMany({
        where,
        include: reservationInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.inventoryReservation.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async adjust(
    organizationId: string,
    actorUserId: string,
    dto: AdjustInventoryDto,
  ) {
    const prepared = await this.prepareBalance(
      organizationId,
      dto.warehouseId,
      dto.variantId,
    );
    const reference = getReferencePair(dto.referenceType, dto.referenceId);
    const reason = dto.reason.trim();
    const operationId = randomUUID();

    return this.prisma.$transaction(async (transaction) => {
      const [balance] = await this.lockBalances(transaction, organizationId, [
        prepared.id,
      ]);
      const next = applyDelta(balance, dto.quantityDelta, 0);
      await updateBalance(transaction, balance.id, next);
      const movement = await transaction.inventoryMovement.create({
        data: movementData(
          balance,
          next,
          organizationId,
          actorUserId,
          operationId,
          InventoryMovementType.ADJUSTMENT,
          dto.quantityDelta,
          0,
          reason,
          reference,
        ),
      });
      const updated = await getBalanceOrThrow(transaction, balance.id);
      return { balance: toBalanceView(updated), movement, operationId };
    });
  }

  async transfer(
    organizationId: string,
    actorUserId: string,
    dto: TransferInventoryDto,
  ) {
    if (dto.sourceWarehouseId === dto.destinationWarehouseId) {
      throw new BadRequestException(
        'Source and destination warehouses must be different',
      );
    }
    const [sourcePrepared, destinationPrepared] = await Promise.all([
      this.prepareBalance(organizationId, dto.sourceWarehouseId, dto.variantId),
      this.prepareBalance(
        organizationId,
        dto.destinationWarehouseId,
        dto.variantId,
      ),
    ]);
    const reference = getReferencePair(dto.referenceType, dto.referenceId);
    const reason = dto.reason.trim();
    const operationId = randomUUID();

    return this.prisma.$transaction(async (transaction) => {
      const balances = await this.lockBalances(transaction, organizationId, [
        sourcePrepared.id,
        destinationPrepared.id,
      ]);
      const source = getLockedBalance(balances, sourcePrepared.id);
      const destination = getLockedBalance(balances, destinationPrepared.id);
      assertAvailable(source, dto.quantity);
      const sourceNext = applyDelta(source, -dto.quantity, 0);
      const destinationNext = applyDelta(destination, dto.quantity, 0);

      await updateBalance(transaction, source.id, sourceNext);
      await updateBalance(transaction, destination.id, destinationNext);
      const sourceMovement = await transaction.inventoryMovement.create({
        data: movementData(
          source,
          sourceNext,
          organizationId,
          actorUserId,
          operationId,
          InventoryMovementType.TRANSFER_OUT,
          -dto.quantity,
          0,
          reason,
          reference,
        ),
      });
      const destinationMovement = await transaction.inventoryMovement.create({
        data: movementData(
          destination,
          destinationNext,
          organizationId,
          actorUserId,
          operationId,
          InventoryMovementType.TRANSFER_IN,
          dto.quantity,
          0,
          reason,
          reference,
        ),
      });
      const sourceUpdated = await getBalanceOrThrow(transaction, source.id);
      const destinationUpdated = await getBalanceOrThrow(
        transaction,
        destination.id,
      );
      return {
        destination: toBalanceView(destinationUpdated),
        movements: [sourceMovement, destinationMovement],
        operationId,
        source: toBalanceView(sourceUpdated),
      };
    });
  }

  async reserve(
    organizationId: string,
    actorUserId: string,
    dto: ReserveInventoryDto,
  ) {
    const prepared = await this.prepareBalance(
      organizationId,
      dto.warehouseId,
      dto.variantId,
    );
    const externalReference = getReferencePair(
      dto.referenceType,
      dto.referenceId,
    );
    const reason = dto.reason.trim();
    const operationId = randomUUID();

    return this.prisma.$transaction(async (transaction) => {
      const [balance] = await this.lockBalances(transaction, organizationId, [
        prepared.id,
      ]);
      const existing =
        externalReference.referenceType && externalReference.referenceId
          ? await transaction.inventoryReservation.findFirst({
              where: {
                balanceId: balance.id,
                organizationId,
                referenceId: externalReference.referenceId,
                referenceType: externalReference.referenceType,
              },
              include: reservationInclude,
            })
          : null;
      if (existing) {
        if (existing.quantity !== dto.quantity) {
          throw new ConflictException(
            'Inventory reservation reference is already in use',
          );
        }
        return {
          balance: toBalanceView(
            await getBalanceOrThrow(transaction, balance.id),
          ),
          idempotent: true,
          reservation: existing,
        };
      }

      assertAvailable(balance, dto.quantity);
      const next = applyDelta(balance, 0, dto.quantity);
      const reservation = await transaction.inventoryReservation.create({
        data: {
          balanceId: balance.id,
          createdByUserId: actorUserId,
          organizationId,
          quantity: dto.quantity,
          reason,
          ...externalReference,
        },
      });
      await updateBalance(transaction, balance.id, next);
      const movement = await transaction.inventoryMovement.create({
        data: movementData(
          balance,
          next,
          organizationId,
          actorUserId,
          operationId,
          InventoryMovementType.RESERVATION,
          0,
          dto.quantity,
          reason,
          {
            referenceId: reservation.id,
            referenceType: 'inventory-reservation',
          },
        ),
      });
      const updated = await getBalanceOrThrow(transaction, balance.id);
      const reservationWithRelations =
        await transaction.inventoryReservation.findUniqueOrThrow({
          where: { id: reservation.id },
          include: reservationInclude,
        });
      return {
        balance: toBalanceView(updated),
        idempotent: false,
        movement,
        operationId,
        reservation: reservationWithRelations,
      };
    });
  }

  async release(
    organizationId: string,
    actorUserId: string,
    reservationId: string,
    dto: ReleaseReservationDto,
  ) {
    const reason = dto.reason.trim();
    const operationId = randomUUID();

    return this.prisma.$transaction(async (transaction) => {
      const reservation = await this.lockReservation(
        transaction,
        organizationId,
        reservationId,
      );
      if (reservation.status === InventoryReservationStatus.RELEASED) {
        return {
          balance: toBalanceView(
            await getBalanceOrThrow(transaction, reservation.balanceId),
          ),
          idempotent: true,
          reservation: await transaction.inventoryReservation.findUniqueOrThrow(
            {
              where: { id: reservation.id },
              include: reservationInclude,
            },
          ),
        };
      }

      const [balance] = await this.lockBalances(transaction, organizationId, [
        reservation.balanceId,
      ]);
      if (balance.reservedQuantity < reservation.quantity) {
        throw new ConflictException('Inventory reservation state is invalid');
      }
      const next = applyDelta(balance, 0, -reservation.quantity);
      await updateBalance(transaction, balance.id, next);
      const released = await transaction.inventoryReservation.update({
        where: { id: reservation.id },
        data: {
          releaseReason: reason,
          releasedAt: new Date(),
          releasedByUserId: actorUserId,
          status: InventoryReservationStatus.RELEASED,
        },
        include: reservationInclude,
      });
      const movement = await transaction.inventoryMovement.create({
        data: movementData(
          balance,
          next,
          organizationId,
          actorUserId,
          operationId,
          InventoryMovementType.RELEASE,
          0,
          -reservation.quantity,
          reason,
          {
            referenceId: reservation.id,
            referenceType: 'inventory-reservation',
          },
        ),
      });
      return {
        balance: toBalanceView(
          await getBalanceOrThrow(transaction, balance.id),
        ),
        idempotent: false,
        movement,
        operationId,
        reservation: released,
      };
    });
  }

  private async prepareBalance(
    organizationId: string,
    warehouseId: string,
    variantId: string,
  ) {
    const [warehouse, variant] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { active: true, id: warehouseId, organizationId },
        select: { id: true },
      }),
      this.prisma.productVariant.findFirst({
        where: {
          active: true,
          id: variantId,
          organizationId,
          product: { is: { active: true } },
        },
        select: { id: true },
      }),
    ]);
    if (!warehouse) throw new BadRequestException('warehouseId is invalid');
    if (!variant) throw new BadRequestException('variantId is invalid');
    return this.prisma.inventoryBalance.upsert({
      where: {
        organizationId_warehouseId_variantId: {
          organizationId,
          variantId,
          warehouseId,
        },
      },
      create: { organizationId, variantId, warehouseId },
      update: {},
      select: { id: true },
    });
  }

  private async lockBalances(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    balanceIds: string[],
  ) {
    const uniqueIds = [...new Set(balanceIds)].sort();
    const balances = await transaction.$queryRaw<LockedBalance[]>(Prisma.sql`
      SELECT "id", "organizationId", "warehouseId", "variantId",
             "physicalQuantity", "reservedQuantity"
      FROM "InventoryBalance"
      WHERE "organizationId" = ${organizationId}
        AND "id" IN (${Prisma.join(uniqueIds)})
      ORDER BY "id"
      FOR UPDATE
    `);
    if (balances.length !== uniqueIds.length) {
      throw new NotFoundException('Inventory balance not found');
    }
    return balances;
  }

  private async lockReservation(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    reservationId: string,
  ) {
    const [reservation] = await transaction.$queryRaw<LockedReservation[]>(
      Prisma.sql`
        SELECT "id", "organizationId", "balanceId", "quantity", "status"
        FROM "InventoryReservation"
        WHERE "organizationId" = ${organizationId}
          AND "id" = ${reservationId}
        FOR UPDATE
      `,
    );
    if (!reservation) {
      throw new NotFoundException('Inventory reservation not found');
    }
    return reservation;
  }
}

function toBalanceView(balance: BalanceWithRelations) {
  return {
    ...balance,
    availableQuantity: balance.physicalQuantity - balance.reservedQuantity,
  };
}

function getReferencePair(
  referenceType: string | undefined,
  referenceId: string | undefined,
): ReferencePair {
  if (Boolean(referenceType) !== Boolean(referenceId)) {
    throw new BadRequestException(
      'referenceType and referenceId must be provided together',
    );
  }
  return referenceType && referenceId
    ? { referenceId: referenceId.trim(), referenceType: referenceType.trim() }
    : {};
}

function assertAvailable(balance: LockedBalance, quantity: number) {
  const available = balance.physicalQuantity - balance.reservedQuantity;
  if (available < quantity) {
    throw new ConflictException('Insufficient available inventory');
  }
}

function applyDelta(
  balance: LockedBalance,
  physicalDelta: number,
  reservedDelta: number,
): InventoryState {
  const physicalAfter = balance.physicalQuantity + physicalDelta;
  const reservedAfter = balance.reservedQuantity + reservedDelta;
  if (
    !Number.isSafeInteger(physicalAfter) ||
    !Number.isSafeInteger(reservedAfter) ||
    physicalAfter < 0 ||
    reservedAfter < 0 ||
    reservedAfter > physicalAfter
  ) {
    throw new ConflictException('Insufficient available inventory');
  }
  if (
    physicalAfter > maximumInventoryQuantity ||
    reservedAfter > maximumInventoryQuantity
  ) {
    throw new ConflictException('Inventory quantity limit exceeded');
  }
  return { physicalAfter, reservedAfter };
}

function movementData(
  balance: LockedBalance,
  next: InventoryState,
  organizationId: string,
  actorUserId: string,
  operationId: string,
  type: InventoryMovementType,
  physicalDelta: number,
  reservedDelta: number,
  reason: string,
  reference: ReferencePair,
): Prisma.InventoryMovementUncheckedCreateInput {
  return {
    actorUserId,
    balanceId: balance.id,
    operationId,
    organizationId,
    physicalAfter: next.physicalAfter,
    physicalBefore: balance.physicalQuantity,
    physicalDelta,
    reason,
    reservedAfter: next.reservedAfter,
    reservedBefore: balance.reservedQuantity,
    reservedDelta,
    type,
    ...reference,
  };
}

function updateBalance(
  transaction: Prisma.TransactionClient,
  balanceId: string,
  state: InventoryState,
) {
  return transaction.inventoryBalance.update({
    where: { id: balanceId },
    data: {
      physicalQuantity: state.physicalAfter,
      reservedQuantity: state.reservedAfter,
    },
  });
}

function getBalanceOrThrow(
  transaction: Prisma.TransactionClient,
  balanceId: string,
) {
  return transaction.inventoryBalance.findUniqueOrThrow({
    where: { id: balanceId },
    include: balanceInclude,
  });
}

function getLockedBalance(balances: LockedBalance[], id: string) {
  const balance = balances.find((candidate) => candidate.id === id);
  if (!balance) throw new NotFoundException('Inventory balance not found');
  return balance;
}
