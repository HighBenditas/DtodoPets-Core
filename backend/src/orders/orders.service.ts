import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { toClpDecimal } from '../common/money/clp';
import { createPage, getPagination } from '../common/pagination/pagination';
import {
  InventoryMovementType,
  InventoryReservationStatus,
  OrderStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransitionOrderDto } from './dto/transition-order.dto';

const orderListInclude = {
  _count: { select: { items: true } },
  customer: { select: { email: true, id: true, name: true, phone: true } },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

const orderDetailInclude = {
  createdBy: {
    select: { email: true, firstName: true, id: true, lastName: true },
  },
  customer: { select: { email: true, id: true, name: true, phone: true } },
  items: {
    include: {
      inventoryReservation: { select: { id: true, status: true } },
      variant: { select: { id: true, sku: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  statusHistory: {
    include: {
      actor: {
        select: { email: true, firstName: true, id: true, lastName: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

interface LockedBalance {
  id: string;
  organizationId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  variantId: string;
  warehouseId: string;
}

interface LockedOrder {
  id: string;
  organizationId: string;
  status: OrderStatus;
}

interface PreparedItem {
  balanceId: string;
  discountAmount: number;
  nameSnapshot: string;
  quantity: number;
  skuSnapshot: string;
  subtotalAmount: number;
  totalAmount: number;
  unitPriceAmount: number;
  variantId: string;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: OrderQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.OrderWhereInput = {
      organizationId,
      customerId: query.customerId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              {
                customer: {
                  is: { name: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderListInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.order.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async findOne(organizationId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, organizationId },
      include: orderDetailInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateOrderDto,
  ) {
    validateUniqueVariants(dto.items.map(({ variantId }) => variantId));
    const customer = await this.prisma.customer.findFirst({
      where: { active: true, id: dto.customerId, organizationId },
    });
    const address = await this.prisma.customerAddress.findFirst({
      where: {
        active: true,
        customerId: dto.customerId,
        id: dto.customerAddressId,
        organizationId,
      },
    });
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { active: true, id: dto.warehouseId, organizationId },
      select: { id: true },
    });
    const variants = await this.prisma.productVariant.findMany({
      where: {
        active: true,
        id: { in: dto.items.map(({ variantId }) => variantId) },
        organizationId,
        product: { is: { active: true } },
      },
      select: {
        id: true,
        name: true,
        priceAmount: true,
        product: { select: { name: true } },
        salePriceAmount: true,
        sku: true,
      },
    });
    if (!customer) throw new BadRequestException('customerId is invalid');
    if (!address) throw new BadRequestException('customerAddressId is invalid');
    if (!warehouse) throw new BadRequestException('warehouseId is invalid');
    if (variants.length !== dto.items.length) {
      throw new BadRequestException('One or more variantId values are invalid');
    }

    const variantsById = new Map(
      variants.map((variant) => [variant.id, variant]),
    );
    const balances: Array<{ id: string; variantId: string }> = [];
    for (const { variantId } of dto.items) {
      balances.push(
        await this.prisma.inventoryBalance.upsert({
          where: {
            organizationId_warehouseId_variantId: {
              organizationId,
              variantId,
              warehouseId: dto.warehouseId,
            },
          },
          create: {
            organizationId,
            variantId,
            warehouseId: dto.warehouseId,
          },
          update: {},
          select: { id: true, variantId: true },
        }),
      );
    }
    const balanceByVariant = new Map(
      balances.map((balance) => [balance.variantId, balance.id]),
    );
    const preparedItems: PreparedItem[] = dto.items.map((item) => {
      const variant = variantsById.get(item.variantId);
      const balanceId = balanceByVariant.get(item.variantId);
      if (!variant || !balanceId) {
        throw new BadRequestException('variantId is invalid');
      }
      const unitPriceAmount = Number(
        variant.salePriceAmount ?? variant.priceAmount,
      );
      const subtotalAmount = unitPriceAmount * item.quantity;
      const discountAmount = item.discountAmount ?? 0;
      assertClp(subtotalAmount);
      if (discountAmount > subtotalAmount) {
        throw new BadRequestException('Item discount exceeds subtotal');
      }
      return {
        balanceId,
        discountAmount,
        nameSnapshot: variant.name
          ? `${variant.product.name} - ${variant.name}`
          : variant.product.name,
        quantity: item.quantity,
        skuSnapshot: variant.sku,
        subtotalAmount,
        totalAmount: subtotalAmount - discountAmount,
        unitPriceAmount,
        variantId: item.variantId,
      };
    });
    const subtotalAmount = preparedItems.reduce(
      (sum, item) => sum + item.subtotalAmount,
      0,
    );
    const lineDiscounts = preparedItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );
    const discountAmount = lineDiscounts + (dto.discountAmount ?? 0);
    const shippingAmount = dto.shippingAmount ?? 0;
    if (discountAmount > subtotalAmount) {
      throw new BadRequestException('Order discount exceeds subtotal');
    }
    const totalAmount = subtotalAmount - discountAmount + shippingAmount;
    [subtotalAmount, discountAmount, shippingAmount, totalAmount].forEach(
      assertClp,
    );

    const number = createOrderNumber();
    const reason = `Order ${number} created`;
    const operationId = randomUUID();
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const lockedBalances = await lockBalances(
          transaction,
          organizationId,
          preparedItems.map(({ balanceId }) => balanceId),
        );
        for (const item of preparedItems) {
          assertAvailable(
            getBalance(lockedBalances, item.balanceId),
            item.quantity,
          );
        }
        const order = await transaction.order.create({
          data: {
            createdByUserId: actorUserId,
            currency: 'CLP',
            customerAddressId: address.id,
            customerId: customer.id,
            customerSnapshot: customerSnapshot(customer),
            discountAmount: toClpDecimal(discountAmount),
            notes: dto.notes?.trim() || null,
            number,
            organizationId,
            shippingAmount: toClpDecimal(shippingAmount),
            shippingSnapshot: addressSnapshot(address),
            subtotalAmount: toClpDecimal(subtotalAmount),
            totalAmount: toClpDecimal(totalAmount),
            warehouseId: dto.warehouseId,
          },
        });

        for (const item of preparedItems) {
          const balance = getBalance(lockedBalances, item.balanceId);
          const orderItem = await transaction.orderItem.create({
            data: {
              discountAmount: toClpDecimal(item.discountAmount),
              nameSnapshot: item.nameSnapshot,
              orderId: order.id,
              organizationId,
              quantity: item.quantity,
              skuSnapshot: item.skuSnapshot,
              subtotalAmount: toClpDecimal(item.subtotalAmount),
              totalAmount: toClpDecimal(item.totalAmount),
              unitPriceAmount: toClpDecimal(item.unitPriceAmount),
              variantId: item.variantId,
            },
          });
          const reservation = await transaction.inventoryReservation.create({
            data: {
              balanceId: balance.id,
              createdByUserId: actorUserId,
              organizationId,
              quantity: item.quantity,
              reason,
              referenceId: orderItem.id,
              referenceType: 'order-item',
            },
          });
          const reservedAfter = balance.reservedQuantity + item.quantity;
          await transaction.inventoryBalance.update({
            where: { id: balance.id },
            data: { reservedQuantity: reservedAfter },
          });
          await transaction.inventoryMovement.create({
            data: {
              actorUserId,
              balanceId: balance.id,
              operationId,
              organizationId,
              physicalAfter: balance.physicalQuantity,
              physicalBefore: balance.physicalQuantity,
              physicalDelta: 0,
              reason,
              referenceId: order.id,
              referenceType: 'order',
              reservedAfter,
              reservedBefore: balance.reservedQuantity,
              reservedDelta: item.quantity,
              type: InventoryMovementType.RESERVATION,
            },
          });
          await transaction.orderItem.update({
            where: { id: orderItem.id },
            data: { inventoryReservationId: reservation.id },
          });
          balance.reservedQuantity = reservedAfter;
        }
        await transaction.orderStatusHistory.create({
          data: {
            actorUserId,
            orderId: order.id,
            organizationId,
            reason: 'Order created and inventory reserved',
            status: OrderStatus.PENDING,
          },
        });
        return getOrderOrThrow(transaction, order.id);
      });
    } catch (error) {
      throwOrderConflict(error);
      throw error;
    }
  }

  async confirm(
    organizationId: string,
    actorUserId: string,
    orderId: string,
    dto: TransitionOrderDto,
  ) {
    const reason = requiredReason(dto.reason);
    const operationId = randomUUID();
    return this.prisma.$transaction(async (transaction) => {
      const order = await lockOrder(transaction, organizationId, orderId);
      if (order.status === OrderStatus.CONFIRMED) {
        return {
          idempotent: true,
          order: await getOrderOrThrow(transaction, orderId),
        };
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be confirmed');
      }
      const items = await getItemsWithReservations(
        transaction,
        organizationId,
        orderId,
      );
      const reservations = items.map(({ inventoryReservation }) => {
        if (
          !inventoryReservation ||
          inventoryReservation.status !== InventoryReservationStatus.ACTIVE
        ) {
          throw new ConflictException('Order inventory reservation is invalid');
        }
        return inventoryReservation;
      });
      const balances = await lockBalances(
        transaction,
        organizationId,
        reservations.map(({ balanceId }) => balanceId),
      );
      const now = new Date();
      for (const reservation of reservations) {
        const balance = getBalance(balances, reservation.balanceId);
        if (
          balance.physicalQuantity < reservation.quantity ||
          balance.reservedQuantity < reservation.quantity
        ) {
          throw new ConflictException('Order inventory reservation is invalid');
        }
        const physicalAfter = balance.physicalQuantity - reservation.quantity;
        const reservedAfter = balance.reservedQuantity - reservation.quantity;
        await transaction.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            physicalQuantity: physicalAfter,
            reservedQuantity: reservedAfter,
          },
        });
        await transaction.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            consumeReason: reason,
            consumedAt: now,
            consumedByUserId: actorUserId,
            status: InventoryReservationStatus.CONSUMED,
          },
        });
        await transaction.inventoryMovement.create({
          data: {
            actorUserId,
            balanceId: balance.id,
            operationId,
            organizationId,
            physicalAfter,
            physicalBefore: balance.physicalQuantity,
            physicalDelta: -reservation.quantity,
            reason,
            referenceId: orderId,
            referenceType: 'order',
            reservedAfter,
            reservedBefore: balance.reservedQuantity,
            reservedDelta: -reservation.quantity,
            type: InventoryMovementType.COMMIT,
          },
        });
        balance.physicalQuantity = physicalAfter;
        balance.reservedQuantity = reservedAfter;
      }
      await transaction.order.update({
        where: { id: orderId },
        data: { confirmedAt: now, status: OrderStatus.CONFIRMED },
      });
      await createStatusHistory(
        transaction,
        organizationId,
        actorUserId,
        orderId,
        OrderStatus.CONFIRMED,
        reason,
      );
      return {
        idempotent: false,
        order: await getOrderOrThrow(transaction, orderId),
      };
    });
  }

  async cancel(
    organizationId: string,
    actorUserId: string,
    orderId: string,
    dto: TransitionOrderDto,
  ) {
    const reason = requiredReason(dto.reason);
    const operationId = randomUUID();
    return this.prisma.$transaction(async (transaction) => {
      const order = await lockOrder(transaction, organizationId, orderId);
      if (order.status === OrderStatus.CANCELLED) {
        return {
          idempotent: true,
          order: await getOrderOrThrow(transaction, orderId),
        };
      }
      if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException('Only pending orders can be cancelled');
      }
      const items = await getItemsWithReservations(
        transaction,
        organizationId,
        orderId,
      );
      const reservations = items.map(({ inventoryReservation }) => {
        if (
          !inventoryReservation ||
          inventoryReservation.status !== InventoryReservationStatus.ACTIVE
        ) {
          throw new ConflictException('Order inventory reservation is invalid');
        }
        return inventoryReservation;
      });
      const balances = await lockBalances(
        transaction,
        organizationId,
        reservations.map(({ balanceId }) => balanceId),
      );
      const now = new Date();
      for (const reservation of reservations) {
        const balance = getBalance(balances, reservation.balanceId);
        if (balance.reservedQuantity < reservation.quantity) {
          throw new ConflictException('Order inventory reservation is invalid');
        }
        const reservedAfter = balance.reservedQuantity - reservation.quantity;
        await transaction.inventoryBalance.update({
          where: { id: balance.id },
          data: { reservedQuantity: reservedAfter },
        });
        await transaction.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            releaseReason: reason,
            releasedAt: now,
            releasedByUserId: actorUserId,
            status: InventoryReservationStatus.RELEASED,
          },
        });
        await transaction.inventoryMovement.create({
          data: {
            actorUserId,
            balanceId: balance.id,
            operationId,
            organizationId,
            physicalAfter: balance.physicalQuantity,
            physicalBefore: balance.physicalQuantity,
            physicalDelta: 0,
            reason,
            referenceId: orderId,
            referenceType: 'order',
            reservedAfter,
            reservedBefore: balance.reservedQuantity,
            reservedDelta: -reservation.quantity,
            type: InventoryMovementType.RELEASE,
          },
        });
        balance.reservedQuantity = reservedAfter;
      }
      await transaction.order.update({
        where: { id: orderId },
        data: { cancelledAt: now, status: OrderStatus.CANCELLED },
      });
      await createStatusHistory(
        transaction,
        organizationId,
        actorUserId,
        orderId,
        OrderStatus.CANCELLED,
        reason,
      );
      return {
        idempotent: false,
        order: await getOrderOrThrow(transaction, orderId),
      };
    });
  }
}

function customerSnapshot(customer: {
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
  rut: string | null;
}): Prisma.InputJsonObject {
  return {
    id: customer.id,
    name: customer.name,
    ...(customer.email ? { email: customer.email } : {}),
    ...(customer.phone ? { phone: customer.phone } : {}),
    ...(customer.rut ? { rut: customer.rut } : {}),
  };
}

function addressSnapshot(address: {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  commune: string;
  id: string;
  instructions: string | null;
  label: string;
  phone: string | null;
  postalCode: string | null;
  recipientName: string;
  region: string;
}): Prisma.InputJsonObject {
  return {
    addressLine1: address.addressLine1,
    city: address.city,
    commune: address.commune,
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    region: address.region,
    ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
    ...(address.instructions ? { instructions: address.instructions } : {}),
    ...(address.phone ? { phone: address.phone } : {}),
    ...(address.postalCode ? { postalCode: address.postalCode } : {}),
  };
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function validateUniqueVariants(variantIds: string[]) {
  if (new Set(variantIds).size !== variantIds.length) {
    throw new BadRequestException('Order variants must be unique');
  }
}

function assertClp(value: number) {
  toClpDecimal(value);
}

function assertAvailable(balance: LockedBalance, quantity: number) {
  if (balance.physicalQuantity - balance.reservedQuantity < quantity) {
    throw new ConflictException('Insufficient available inventory');
  }
}

async function lockBalances(
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

function getBalance(balances: LockedBalance[], id: string) {
  const balance = balances.find((candidate) => candidate.id === id);
  if (!balance) throw new NotFoundException('Inventory balance not found');
  return balance;
}

async function lockOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const [order] = await transaction.$queryRaw<LockedOrder[]>(Prisma.sql`
    SELECT "id", "organizationId", "status"
    FROM "Order"
    WHERE "organizationId" = ${organizationId}
      AND "id" = ${orderId}
    FOR UPDATE
  `);
  if (!order) throw new NotFoundException('Order not found');
  return order;
}

function getItemsWithReservations(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  return transaction.orderItem.findMany({
    where: { orderId, organizationId },
    include: {
      inventoryReservation: {
        select: { balanceId: true, id: true, quantity: true, status: true },
      },
    },
    orderBy: { id: 'asc' },
  });
}

function getOrderOrThrow(
  transaction: Prisma.TransactionClient,
  orderId: string,
) {
  return transaction.order.findUniqueOrThrow({
    where: { id: orderId },
    include: orderDetailInclude,
  });
}

function createStatusHistory(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  actorUserId: string,
  orderId: string,
  status: OrderStatus,
  reason: string,
) {
  return transaction.orderStatusHistory.create({
    data: { actorUserId, orderId, organizationId, reason, status },
  });
}

function requiredReason(value: string) {
  const reason = value.trim();
  if (!reason) throw new BadRequestException('reason must not be blank');
  return reason;
}

function throwOrderConflict(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('Order number or reference is already in use');
  }
}
