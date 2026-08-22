import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { createPage, getPagination } from '../common/pagination/pagination';
import {
  InventoryMovementType,
  OrderStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnQueryDto } from './dto/return-query.dto';

const returnInclude = {
  createdBy: {
    select: { email: true, firstName: true, id: true, lastName: true },
  },
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
      status: true,
    },
  },
} satisfies Prisma.OrderReturnInclude;

type ReturnWithRelations = Prisma.OrderReturnGetPayload<{
  include: typeof returnInclude;
}>;

interface LockedBalance {
  id: string;
  organizationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
}

interface LockedOrder {
  id: string;
  status: OrderStatus;
}

const maximumInventoryQuantity = 2_000_000_000;

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: ReturnQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.OrderReturnWhereInput = {
      orderId: query.orderId,
      organizationId,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
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
      this.prisma.orderReturn.findMany({
        where,
        include: returnInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.orderReturn.count({ where }),
    ]);
    return createPage(data.map(toReturnView), total, query);
  }

  async findOne(organizationId: string, id: string) {
    const orderReturn = await this.prisma.orderReturn.findFirst({
      where: { id, organizationId },
      include: returnInclude,
    });
    if (!orderReturn) throw new NotFoundException('Return not found');
    return toReturnView(orderReturn);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateReturnDto,
  ) {
    const prepared = prepareReturn(dto);
    const replay = await this.prisma.orderReturn.findUnique({
      where: {
        organizationId_idempotencyKey: {
          idempotencyKey: prepared.idempotencyKey,
          organizationId,
        },
      },
      include: returnInclude,
    });
    if (replay) return returnReplay(replay, prepared.requestHash);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const order = await lockOrder(transaction, organizationId, dto.orderId);
        if (
          order.status !== OrderStatus.CONFIRMED &&
          order.status !== OrderStatus.COMPLETED
        ) {
          throw new ConflictException(
            'Returns require a confirmed or completed order',
          );
        }
        const concurrentReplay = await transaction.orderReturn.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: returnInclude,
        });
        if (concurrentReplay) {
          return returnReplay(concurrentReplay, prepared.requestHash);
        }

        const orderItems = await transaction.orderItem.findMany({
          where: {
            id: { in: prepared.items.map(({ orderItemId }) => orderItemId) },
            orderId: dto.orderId,
            organizationId,
          },
          select: {
            id: true,
            inventoryReservation: { select: { balanceId: true } },
            quantity: true,
          },
        });
        if (orderItems.length !== prepared.items.length) {
          throw new BadRequestException(
            'One or more orderItemId values are invalid',
          );
        }
        const previouslyReturned = await transaction.orderReturnItem.groupBy({
          by: ['orderItemId'],
          where: {
            orderItemId: {
              in: prepared.items.map(({ orderItemId }) => orderItemId),
            },
            organizationId,
          },
          _sum: { quantity: true },
        });
        const previousByItem = new Map(
          previouslyReturned.map((item) => [
            item.orderItemId,
            item._sum.quantity ?? 0,
          ]),
        );
        const orderItemById = new Map(
          orderItems.map((item) => [item.id, item]),
        );
        for (const item of prepared.items) {
          const orderItem = orderItemById.get(item.orderItemId);
          if (!orderItem) {
            throw new BadRequestException('orderItemId is invalid');
          }
          const previousQuantity = previousByItem.get(item.orderItemId) ?? 0;
          if (previousQuantity + item.quantity > orderItem.quantity) {
            throw new ConflictException(
              'Return quantity exceeds the remaining order item quantity',
            );
          }
          if (item.restock && !orderItem.inventoryReservation) {
            throw new ConflictException(
              'Order item has no inventory origin for restocking',
            );
          }
        }

        const balanceIds = prepared.items.flatMap((item) => {
          const balanceId = orderItemById.get(item.orderItemId)
            ?.inventoryReservation?.balanceId;
          return item.restock && balanceId ? [balanceId] : [];
        });
        const balances = await lockBalances(
          transaction,
          organizationId,
          balanceIds,
        );
        const number = createReturnNumber();
        const orderReturn = await transaction.orderReturn.create({
          data: {
            createdByUserId: actorUserId,
            idempotencyKey: prepared.idempotencyKey,
            number,
            orderId: dto.orderId,
            organizationId,
            reason: prepared.reason,
            requestHash: prepared.requestHash,
          },
        });
        const operationId = randomUUID();
        for (const item of prepared.items) {
          const orderItem = orderItemById.get(item.orderItemId);
          if (!orderItem)
            throw new BadRequestException('orderItemId is invalid');
          const returnItem = await transaction.orderReturnItem.create({
            data: {
              orderItemId: item.orderItemId,
              orderReturnId: orderReturn.id,
              organizationId,
              quantity: item.quantity,
              restocked: item.restock,
            },
          });
          if (!item.restock) continue;
          const balanceId = orderItem.inventoryReservation?.balanceId;
          const balance = balances.find(({ id }) => id === balanceId);
          if (!balance) {
            throw new ConflictException('Return inventory balance is invalid');
          }
          const physicalAfter = balance.physicalQuantity + item.quantity;
          if (physicalAfter > maximumInventoryQuantity) {
            throw new ConflictException('Inventory quantity limit exceeded');
          }
          await transaction.inventoryBalance.update({
            where: { id: balance.id },
            data: { physicalQuantity: physicalAfter },
          });
          await transaction.inventoryMovement.create({
            data: {
              actorUserId,
              balanceId: balance.id,
              operationId,
              organizationId,
              physicalAfter,
              physicalBefore: balance.physicalQuantity,
              physicalDelta: item.quantity,
              reason: prepared.reason,
              referenceId: returnItem.id,
              referenceType: 'return-item',
              reservedAfter: balance.reservedQuantity,
              reservedBefore: balance.reservedQuantity,
              reservedDelta: 0,
              type: InventoryMovementType.RETURN,
            },
          });
          balance.physicalQuantity = physicalAfter;
        }
        return {
          idempotent: false,
          return: toReturnView(
            await getReturnOrThrow(transaction, orderReturn.id),
          ),
        };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.prisma.orderReturn.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: returnInclude,
        });
        if (concurrentReplay) {
          return returnReplay(concurrentReplay, prepared.requestHash);
        }
        throw new ConflictException('Return number is already in use');
      }
      throw error;
    }
  }
}

function prepareReturn(dto: CreateReturnDto) {
  const uniqueItemIds = new Set(
    dto.items.map(({ orderItemId }) => orderItemId),
  );
  if (uniqueItemIds.size !== dto.items.length) {
    throw new BadRequestException('Return order items must be unique');
  }
  const idempotencyKey = dto.idempotencyKey.trim();
  const reason = dto.reason.trim();
  const items = dto.items
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      restock: item.restock ?? false,
    }))
    .sort((left, right) => left.orderItemId.localeCompare(right.orderItemId));
  return {
    idempotencyKey,
    items,
    reason,
    requestHash: createRequestFingerprint({
      items,
      orderId: dto.orderId,
      reason,
    }),
  };
}

function returnReplay(orderReturn: ReturnWithRelations, requestHash: string) {
  if (orderReturn.requestHash !== requestHash) {
    throw new ConflictException(
      'Idempotency key was already used with different return data',
    );
  }
  return { idempotent: true, return: toReturnView(orderReturn) };
}

function toReturnView(orderReturn: ReturnWithRelations) {
  const { requestHash, ...safeReturn } = orderReturn;
  void requestHash;
  return safeReturn;
}

async function lockOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const [order] = await transaction.$queryRaw<LockedOrder[]>(Prisma.sql`
    SELECT "id", "status"
    FROM "Order"
    WHERE "organizationId" = ${organizationId} AND "id" = ${orderId}
    FOR UPDATE
  `);
  if (!order) throw new NotFoundException('Order not found');
  return order;
}

async function lockBalances(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  balanceIds: string[],
) {
  const uniqueIds = [...new Set(balanceIds)].sort();
  if (uniqueIds.length === 0) return [];
  const balances = await transaction.$queryRaw<LockedBalance[]>(Prisma.sql`
    SELECT "id", "organizationId", "physicalQuantity", "reservedQuantity"
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

function getReturnOrThrow(
  transaction: Prisma.TransactionClient,
  orderReturnId: string,
) {
  return transaction.orderReturn.findUniqueOrThrow({
    where: { id: orderReturnId },
    include: returnInclude,
  });
}

function createReturnNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `RET-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
