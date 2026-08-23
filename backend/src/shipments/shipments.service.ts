import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { toClpDecimal } from '../common/money/clp';
import { createPage, getPagination } from '../common/pagination/pagination';
import {
  OrderStatus,
  Prisma,
  ShipmentStatus,
  ShipmentType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentQueryDto } from './dto/shipment-query.dto';
import { TransitionShipmentDto } from './dto/transition-shipment.dto';

const actorSelect = {
  email: true,
  firstName: true,
  id: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const shipmentInclude = {
  createdBy: { select: actorSelect },
  items: {
    include: {
      orderItem: {
        select: {
          id: true,
          nameSnapshot: true,
          quantity: true,
          skuSnapshot: true,
          variantId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  order: {
    select: {
      customer: { select: { id: true, name: true } },
      id: true,
      number: true,
      shippingAmount: true,
      status: true,
    },
  },
  statusHistory: {
    include: { actor: { select: actorSelect } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ShipmentInclude;

type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
  include: typeof shipmentInclude;
}>;

interface LockedOrder {
  id: string;
  shippingAmount: string;
  status: OrderStatus;
}

interface LockedShipment {
  actualCostAmount: string | null;
  cancelledAt: Date | null;
  carrier: string | null;
  deliveredAt: Date | null;
  id: string;
  orderId: string;
  readyAt: Date | null;
  serviceName: string | null;
  shippedAt: Date | null;
  status: ShipmentStatus;
  trackingNumber: string | null;
  trackingUrl: string | null;
  type: ShipmentType;
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ShipmentQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ShipmentWhereInput = {
      orderId: query.orderId,
      organizationId,
      status: query.status,
      type: query.type,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { carrier: { contains: search, mode: 'insensitive' } },
              {
                trackingNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                order: {
                  is: {
                    OR: [
                      { number: { contains: search, mode: 'insensitive' } },
                      {
                        customer: {
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
    const [data, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        include: shipmentInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return createPage(data.map(toShipmentView), total, query);
  }

  async findOne(organizationId: string, id: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, organizationId },
      include: shipmentInclude,
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return toShipmentView(shipment);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateShipmentDto,
  ) {
    const prepared = prepareShipment(dto);
    const replay = await this.prisma.shipment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          idempotencyKey: prepared.idempotencyKey,
          organizationId,
        },
      },
      include: shipmentInclude,
    });
    if (replay) return shipmentReplay(replay, prepared.requestHash);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const order = await lockOrder(transaction, organizationId, dto.orderId);
        if (
          order.status !== OrderStatus.CONFIRMED &&
          order.status !== OrderStatus.COMPLETED
        ) {
          throw new ConflictException(
            'Shipments require a confirmed or completed order',
          );
        }
        const concurrentReplay = await transaction.shipment.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: shipmentInclude,
        });
        if (concurrentReplay) {
          return shipmentReplay(concurrentReplay, prepared.requestHash);
        }

        const orderItems = await transaction.orderItem.findMany({
          where: {
            id: { in: prepared.items.map(({ orderItemId }) => orderItemId) },
            orderId: dto.orderId,
            organizationId,
          },
          select: { id: true, quantity: true },
        });
        if (orderItems.length !== prepared.items.length) {
          throw new BadRequestException(
            'One or more orderItemId values are invalid',
          );
        }
        const allocatedItems = await transaction.shipmentItem.groupBy({
          by: ['orderItemId'],
          where: {
            orderItemId: {
              in: prepared.items.map(({ orderItemId }) => orderItemId),
            },
            organizationId,
            shipment: { is: { status: { not: ShipmentStatus.CANCELLED } } },
          },
          _sum: { quantity: true },
        });
        const allocatedByItem = new Map(
          allocatedItems.map((item) => [
            item.orderItemId,
            item._sum.quantity ?? 0,
          ]),
        );
        const orderItemById = new Map(
          orderItems.map((item) => [item.id, item]),
        );
        for (const item of prepared.items) {
          const orderItem = orderItemById.get(item.orderItemId);
          if (!orderItem)
            throw new BadRequestException('orderItemId is invalid');
          const allocated = allocatedByItem.get(item.orderItemId) ?? 0;
          if (allocated + item.quantity > orderItem.quantity) {
            throw new ConflictException(
              'Shipment quantity exceeds the remaining order item quantity',
            );
          }
        }

        const chargeAggregate = await transaction.shipment.aggregate({
          where: {
            orderId: dto.orderId,
            organizationId,
            status: { not: ShipmentStatus.CANCELLED },
          },
          _sum: { customerChargeAmount: true },
        });
        const allocatedCharge =
          chargeAggregate._sum.customerChargeAmount ?? new Prisma.Decimal(0);
        const customerCharge = toClpDecimal(prepared.customerChargeAmount);
        if (
          allocatedCharge
            .plus(customerCharge)
            .greaterThan(new Prisma.Decimal(order.shippingAmount))
        ) {
          throw new ConflictException(
            'Shipment charge allocation exceeds order shipping amount',
          );
        }

        const shipment = await transaction.shipment.create({
          data: {
            actualCostAmount:
              prepared.actualCostAmount === null
                ? null
                : toClpDecimal(prepared.actualCostAmount),
            carrier: prepared.carrier,
            createdByUserId: actorUserId,
            customerChargeAmount: customerCharge,
            idempotencyKey: prepared.idempotencyKey,
            notes: prepared.notes,
            number: createShipmentNumber(),
            orderId: dto.orderId,
            organizationId,
            requestHash: prepared.requestHash,
            serviceName: prepared.serviceName,
            trackingNumber: prepared.trackingNumber,
            trackingUrl: prepared.trackingUrl,
            type: dto.type,
          },
        });
        for (const item of prepared.items) {
          await transaction.shipmentItem.create({
            data: {
              orderItemId: item.orderItemId,
              organizationId,
              quantity: item.quantity,
              shipmentId: shipment.id,
            },
          });
        }
        await transaction.shipmentStatusHistory.create({
          data: {
            actorUserId,
            actualCostAmount: shipment.actualCostAmount,
            carrier: shipment.carrier,
            organizationId,
            reason: 'Shipment created',
            shipmentId: shipment.id,
            status: ShipmentStatus.PENDING,
            trackingNumber: shipment.trackingNumber,
            trackingUrl: shipment.trackingUrl,
          },
        });
        return {
          idempotent: false,
          shipment: toShipmentView(
            await getShipmentOrThrow(transaction, shipment.id),
          ),
        };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.prisma.shipment.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: shipmentInclude,
        });
        if (concurrentReplay) {
          return shipmentReplay(concurrentReplay, prepared.requestHash);
        }
        throw new ConflictException(
          'Shipment number or tracking reference is already in use',
        );
      }
      throw error;
    }
  }

  async transition(
    organizationId: string,
    actorUserId: string,
    shipmentId: string,
    dto: TransitionShipmentDto,
  ) {
    const reference = await this.prisma.shipment.findFirst({
      where: { id: shipmentId, organizationId },
      select: { orderId: true },
    });
    if (!reference) throw new NotFoundException('Shipment not found');
    const reason = requiredText(dto.reason);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockOrder(transaction, organizationId, reference.orderId);
        const shipment = await lockShipment(
          transaction,
          organizationId,
          shipmentId,
        );
        if (shipment.status === dto.status) {
          return {
            idempotent: true,
            shipment: toShipmentView(
              await getShipmentOrThrow(transaction, shipmentId),
            ),
          };
        }
        assertTransition(shipment.status, dto.status, shipment.type);
        const carrier = optionalText(dto.carrier) ?? shipment.carrier;
        const serviceName =
          optionalText(dto.serviceName) ?? shipment.serviceName;
        const trackingNumber =
          optionalText(dto.trackingNumber) ?? shipment.trackingNumber;
        const trackingUrl =
          optionalText(dto.trackingUrl) ?? shipment.trackingUrl;
        const actualCostAmount =
          dto.actualCostAmount === undefined
            ? shipment.actualCostAmount
            : String(dto.actualCostAmount);
        validateMetadata(
          shipment.type,
          carrier,
          trackingNumber,
          trackingUrl,
          dto.status,
        );
        if (
          dto.status === ShipmentStatus.DELIVERED &&
          actualCostAmount === null
        ) {
          throw new ConflictException(
            'Delivered shipments require an actual cost amount',
          );
        }

        const now = new Date();
        const data: Prisma.ShipmentUncheckedUpdateInput = {
          actualCostAmount:
            actualCostAmount === null
              ? null
              : toClpDecimal(Number(actualCostAmount)),
          carrier,
          serviceName,
          status: dto.status,
          trackingNumber,
          trackingUrl,
        };
        if (dto.status === ShipmentStatus.READY) data.readyAt = now;
        if (dto.status === ShipmentStatus.IN_TRANSIT) data.shippedAt = now;
        if (dto.status === ShipmentStatus.DELIVERED) {
          data.readyAt = shipment.readyAt ?? now;
          data.shippedAt =
            shipment.type === ShipmentType.PICKUP
              ? shipment.shippedAt
              : (shipment.shippedAt ?? now);
          data.deliveredAt = now;
        }
        if (dto.status === ShipmentStatus.CANCELLED) data.cancelledAt = now;

        const updated = await transaction.shipment.update({
          where: { id: shipmentId },
          data,
        });
        await transaction.shipmentStatusHistory.create({
          data: {
            actorUserId,
            actualCostAmount: updated.actualCostAmount,
            carrier: updated.carrier,
            organizationId,
            reason,
            shipmentId,
            status: dto.status,
            trackingNumber: updated.trackingNumber,
            trackingUrl: updated.trackingUrl,
          },
        });
        return {
          idempotent: false,
          shipment: toShipmentView(
            await getShipmentOrThrow(transaction, shipmentId),
          ),
        };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw new ConflictException(
          'Shipment tracking reference is already in use',
        );
      }
      throw error;
    }
  }
}

function prepareShipment(dto: CreateShipmentDto) {
  const uniqueItems = new Set(dto.items.map(({ orderItemId }) => orderItemId));
  if (uniqueItems.size !== dto.items.length) {
    throw new BadRequestException('Shipment order items must be unique');
  }
  const carrier = optionalText(dto.carrier);
  const serviceName = optionalText(dto.serviceName);
  const trackingNumber = optionalText(dto.trackingNumber);
  const trackingUrl = optionalText(dto.trackingUrl);
  validateMetadata(
    dto.type,
    carrier,
    trackingNumber,
    trackingUrl,
    ShipmentStatus.PENDING,
  );
  const actualCostAmount =
    dto.actualCostAmount ?? (dto.type === ShipmentType.PICKUP ? 0 : null);
  const customerChargeAmount = dto.customerChargeAmount ?? 0;
  const idempotencyKey = requiredText(dto.idempotencyKey);
  const items = [...dto.items].sort((left, right) =>
    left.orderItemId.localeCompare(right.orderItemId),
  );
  const notes = optionalText(dto.notes);
  return {
    actualCostAmount,
    carrier,
    customerChargeAmount,
    idempotencyKey,
    items,
    notes,
    requestHash: createRequestFingerprint({
      actualCostAmount,
      carrier,
      customerChargeAmount,
      items,
      notes,
      orderId: dto.orderId,
      serviceName,
      trackingNumber,
      trackingUrl,
      type: dto.type,
    }),
    serviceName,
    trackingNumber,
    trackingUrl,
  };
}

function validateMetadata(
  type: ShipmentType,
  carrier: string | null,
  trackingNumber: string | null,
  trackingUrl: string | null,
  status: ShipmentStatus,
) {
  if (trackingUrl && !trackingNumber) {
    throw new BadRequestException('trackingUrl requires trackingNumber');
  }
  if (
    type === ShipmentType.PICKUP &&
    (carrier || trackingNumber || trackingUrl)
  ) {
    throw new BadRequestException('Pickup shipments cannot have tracking data');
  }
  if (type === ShipmentType.EXTERNAL_COURIER && !carrier) {
    throw new BadRequestException('External courier shipments require carrier');
  }
  if (
    (status === ShipmentStatus.IN_TRANSIT ||
      status === ShipmentStatus.DELIVERED) &&
    (type === ShipmentType.EXTERNAL_COURIER ||
      type === ShipmentType.MARKETPLACE) &&
    !trackingNumber
  ) {
    throw new ConflictException(
      'In-transit external shipments require tracking',
    );
  }
}

function assertTransition(
  current: ShipmentStatus,
  next: ShipmentStatus,
  type: ShipmentType,
) {
  if (next === ShipmentStatus.PENDING) {
    throw new BadRequestException('Cannot transition a shipment to pending');
  }
  const allowed: Partial<Record<ShipmentStatus, ShipmentStatus[]>> = {
    [ShipmentStatus.PENDING]: [ShipmentStatus.READY, ShipmentStatus.CANCELLED],
    [ShipmentStatus.READY]: [
      ShipmentStatus.IN_TRANSIT,
      ShipmentStatus.DELIVERED,
      ShipmentStatus.CANCELLED,
    ],
    [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.DELIVERED],
  };
  if (!allowed[current]?.includes(next)) {
    throw new ConflictException(
      `Shipment cannot transition from ${current} to ${next}`,
    );
  }
  if (type === ShipmentType.PICKUP && next === ShipmentStatus.IN_TRANSIT) {
    throw new ConflictException('Pickup shipments cannot be in transit');
  }
}

function shipmentReplay(shipment: ShipmentWithRelations, requestHash: string) {
  if (shipment.requestHash !== requestHash) {
    throw new ConflictException(
      'Idempotency key was already used with different shipment data',
    );
  }
  return { idempotent: true, shipment: toShipmentView(shipment) };
}

function toShipmentView(shipment: ShipmentWithRelations) {
  const { requestHash, ...safeShipment } = shipment;
  void requestHash;
  if (shipment.actualCostAmount === null) {
    return {
      ...safeShipment,
      shippingMarginAmount: null,
      subsidyAmount: null,
    };
  }
  const difference = shipment.actualCostAmount.minus(
    shipment.customerChargeAmount,
  );
  return {
    ...safeShipment,
    shippingMarginAmount: difference.isNegative()
      ? difference.abs()
      : new Prisma.Decimal(0),
    subsidyAmount: difference.isPositive() ? difference : new Prisma.Decimal(0),
  };
}

async function lockOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const [order] = await transaction.$queryRaw<LockedOrder[]>(Prisma.sql`
    SELECT "id", "status", CAST("shippingAmount" AS TEXT) AS "shippingAmount"
    FROM "Order"
    WHERE "organizationId" = ${organizationId} AND "id" = ${orderId}
    FOR UPDATE
  `);
  if (!order) throw new NotFoundException('Order not found');
  return order;
}

async function lockShipment(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  shipmentId: string,
) {
  const [shipment] = await transaction.$queryRaw<LockedShipment[]>(Prisma.sql`
    SELECT "id", "orderId", "type", "status", "carrier", "serviceName",
           "trackingNumber", "trackingUrl",
           CAST("actualCostAmount" AS TEXT) AS "actualCostAmount",
           "readyAt", "shippedAt", "deliveredAt", "cancelledAt"
    FROM "Shipment"
    WHERE "organizationId" = ${organizationId} AND "id" = ${shipmentId}
    FOR UPDATE
  `);
  if (!shipment) throw new NotFoundException('Shipment not found');
  return shipment;
}

function getShipmentOrThrow(
  transaction: Prisma.TransactionClient,
  shipmentId: string,
) {
  return transaction.shipment.findUniqueOrThrow({
    where: { id: shipmentId },
    include: shipmentInclude,
  });
}

function createShipmentNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SHP-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function requiredText(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException('Required text is blank');
  return normalized;
}

function optionalText(value: string | undefined) {
  return value?.trim() || null;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
