import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { toClpDecimal } from '../common/money/clp';
import {
  InventoryMovementType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  SalesChannelType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePosSaleDto } from './dto/create-pos-sale.dto';
import { PosCatalogQueryDto } from './dto/pos-catalog-query.dto';

const saleInclude = {
  items: { orderBy: { createdAt: 'asc' } },
  payments: {
    orderBy: { createdAt: 'asc' },
    select: {
      amount: true,
      createdAt: true,
      externalReference: true,
      id: true,
      method: true,
      notes: true,
      provider: true,
      status: true,
    },
  },
  salesChannel: { select: { id: true, key: true, name: true } },
  warehouse: { select: { id: true, name: true } },
} satisfies Prisma.OrderInclude;

type PosOrder = Prisma.OrderGetPayload<{ include: typeof saleInclude }>;

interface LockedBalance {
  id: string;
  physicalQuantity: number;
  reservedQuantity: number;
  variantId: string;
}

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async catalog(organizationId: string, query: PosCatalogQueryDto) {
    const search = query.search?.trim();
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { active: true, id: query.warehouseId, organizationId },
      select: { id: true, name: true },
    });
    if (!warehouse) throw new BadRequestException('warehouseId is invalid');

    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        organizationId,
        physicalQuantity: { gt: 0 },
        warehouseId: warehouse.id,
        variant: {
          is: {
            active: true,
            product: { is: { active: true } },
            ...(search
              ? {
                  OR: [
                    { barcode: { contains: search, mode: 'insensitive' } },
                    { sku: { contains: search, mode: 'insensitive' } },
                    {
                      product: {
                        is: { name: { contains: search, mode: 'insensitive' } },
                      },
                    },
                  ],
                }
              : {}),
          },
        },
      },
      include: {
        variant: {
          include: {
            product: {
              select: {
                category: { select: { id: true, name: true } },
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { variant: { product: { name: 'asc' } } },
        { variant: { sku: 'asc' } },
      ],
      take: query.take * 2,
    });

    return {
      data: balances
        .map((balance) => ({
          availableQuantity:
            balance.physicalQuantity - balance.reservedQuantity,
          barcode: balance.variant.barcode,
          category: balance.variant.product.category,
          productId: balance.variant.product.id,
          productName: balance.variant.product.name,
          priceAmount: Number(
            balance.variant.salePriceAmount ?? balance.variant.priceAmount,
          ),
          sku: balance.variant.sku,
          variantId: balance.variant.id,
          variantName: balance.variant.name,
        }))
        .filter(({ availableQuantity }) => availableQuantity > 0)
        .slice(0, query.take),
      warehouse,
    };
  }

  async sell(
    organizationId: string,
    actorUserId: string,
    dto: CreatePosSaleDto,
  ) {
    const prepared = prepareSale(dto);
    const replay = await this.prisma.order.findUnique({
      where: {
        organizationId_checkoutIdempotencyKey: {
          checkoutIdempotencyKey: prepared.idempotencyKey,
          organizationId,
        },
      },
      include: saleInclude,
    });
    if (replay) return saleReplay(replay, prepared.requestHash);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const concurrentReplay = await transaction.order.findUnique({
          where: {
            organizationId_checkoutIdempotencyKey: {
              checkoutIdempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: saleInclude,
        });
        if (concurrentReplay) {
          return saleReplay(concurrentReplay, prepared.requestHash);
        }

        const warehouse = await transaction.warehouse.findFirst({
          where: { active: true, id: dto.warehouseId, organizationId },
          select: { id: true, name: true },
        });
        if (!warehouse) throw new BadRequestException('warehouseId is invalid');
        const channel = await transaction.salesChannel.upsert({
          where: {
            organizationId_key: { key: 'pos-sucursal', organizationId },
          },
          create: {
            createdByUserId: actorUserId,
            key: 'pos-sucursal',
            metadata: { stockSafety: 0 },
            name: 'Venta en sucursal',
            organizationId,
            type: SalesChannelType.MANUAL,
          },
          update: { active: true, name: 'Venta en sucursal' },
        });
        const variants = await transaction.productVariant.findMany({
          where: {
            active: true,
            id: { in: prepared.items.map(({ variantId }) => variantId) },
            organizationId,
            product: { is: { active: true } },
          },
          include: { product: { select: { name: true } } },
        });
        if (variants.length !== prepared.items.length) {
          throw new BadRequestException(
            'One or more variantId values are invalid',
          );
        }
        const variantById = new Map(
          variants.map((variant) => [variant.id, variant]),
        );

        const balances: Array<{ id: string; variantId: string }> = [];
        for (const item of prepared.items) {
          balances.push(
            await transaction.inventoryBalance.upsert({
              where: {
                organizationId_warehouseId_variantId: {
                  organizationId,
                  variantId: item.variantId,
                  warehouseId: warehouse.id,
                },
              },
              create: {
                organizationId,
                variantId: item.variantId,
                warehouseId: warehouse.id,
              },
              update: {},
              select: { id: true, variantId: true },
            }),
          );
        }
        const lockedBalances = await lockBalances(
          transaction,
          organizationId,
          balances.map(({ id }) => id),
        );
        const balanceByVariant = new Map(
          lockedBalances.map((balance) => [balance.variantId, balance]),
        );

        // A concurrent request may have committed while we waited for stock.
        // Replay it before rejecting the now-reduced availability.
        const lockedReplay = await transaction.order.findUnique({
          where: {
            organizationId_checkoutIdempotencyKey: {
              checkoutIdempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: saleInclude,
        });
        if (lockedReplay) {
          return saleReplay(lockedReplay, prepared.requestHash);
        }

        const lineItems = prepared.items.map((item) => {
          const variant = variantById.get(item.variantId);
          const balance = balanceByVariant.get(item.variantId);
          if (!variant || !balance) {
            throw new BadRequestException('variantId is invalid');
          }
          if (
            balance.physicalQuantity - balance.reservedQuantity <
            item.quantity
          ) {
            throw new ConflictException(
              `Stock insuficiente para ${variant.product.name}`,
            );
          }
          const unitPriceAmount = Number(
            variant.salePriceAmount ?? variant.priceAmount,
          );
          const subtotalAmount = unitPriceAmount * item.quantity;
          if (item.discountAmount > subtotalAmount) {
            throw new BadRequestException('Item discount exceeds subtotal');
          }
          return {
            ...item,
            balance,
            nameSnapshot: variant.name
              ? `${variant.product.name} - ${variant.name}`
              : variant.product.name,
            skuSnapshot: variant.sku,
            subtotalAmount,
            totalAmount: subtotalAmount - item.discountAmount,
            unitPriceAmount,
          };
        });
        const subtotalAmount = lineItems.reduce(
          (sum, item) => sum + item.subtotalAmount,
          0,
        );
        const lineDiscounts = lineItems.reduce(
          (sum, item) => sum + item.discountAmount,
          0,
        );
        const discountAmount = lineDiscounts + prepared.discountAmount;
        if (discountAmount > subtotalAmount) {
          throw new BadRequestException('Order discount exceeds subtotal');
        }
        const totalAmount = subtotalAmount - discountAmount;
        const paidAmount = prepared.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        if (paidAmount !== totalAmount) {
          throw new BadRequestException(
            'La suma de los pagos debe coincidir exactamente con el total de la venta',
          );
        }

        const now = new Date();
        const number = createPosOrderNumber();
        const order = await transaction.order.create({
          data: {
            checkoutIdempotencyKey: prepared.idempotencyKey,
            checkoutRequestHash: prepared.requestHash,
            confirmedAt: now,
            createdByUserId: actorUserId,
            currency: 'CLP',
            customerSnapshot: { kind: 'walk-in', name: 'Consumidor final' },
            discountAmount: toClpDecimal(discountAmount),
            notes: prepared.notes,
            number,
            organizationId,
            salesChannelId: channel.id,
            shippingAmount: toClpDecimal(0),
            shippingSnapshot: {
              kind: 'pickup',
              warehouseId: warehouse.id,
              warehouseName: warehouse.name,
            },
            status: OrderStatus.CONFIRMED,
            subtotalAmount: toClpDecimal(subtotalAmount),
            totalAmount: toClpDecimal(totalAmount),
            warehouseId: warehouse.id,
          },
        });
        const operationId = randomUUID();
        for (const item of lineItems) {
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
          const physicalAfter = item.balance.physicalQuantity - item.quantity;
          await transaction.inventoryBalance.update({
            where: { id: item.balance.id },
            data: { physicalQuantity: physicalAfter },
          });
          await transaction.inventoryMovement.create({
            data: {
              actorUserId,
              balanceId: item.balance.id,
              operationId,
              organizationId,
              physicalAfter,
              physicalBefore: item.balance.physicalQuantity,
              physicalDelta: -item.quantity,
              reason: `Venta POS ${number}`,
              referenceId: orderItem.id,
              referenceType: 'order-item',
              reservedAfter: item.balance.reservedQuantity,
              reservedBefore: item.balance.reservedQuantity,
              reservedDelta: 0,
              type: InventoryMovementType.SALE,
            },
          });
        }
        await transaction.orderStatusHistory.create({
          data: {
            actorUserId,
            orderId: order.id,
            organizationId,
            reason: 'Venta de sucursal confirmada y pagada',
            status: OrderStatus.CONFIRMED,
          },
        });
        for (const [index, payment] of prepared.payments.entries()) {
          await transaction.payment.create({
            data: {
              amount: toClpDecimal(payment.amount),
              createdByUserId: actorUserId,
              externalReference: payment.externalReference,
              idempotencyKey: `pos:${prepared.idempotencyKey}:${index}`,
              method: payment.method,
              notes:
                payment.method === PaymentMethod.CASH && payment.tenderedAmount
                  ? `Monto recibido: ${payment.tenderedAmount} CLP`
                  : null,
              orderId: order.id,
              organizationId,
              provider: payment.provider,
              requestHash: createRequestFingerprint({
                amount: payment.amount,
                externalReference: payment.externalReference,
                method: payment.method,
                orderId: order.id,
                provider: payment.provider,
                tenderedAmount: payment.tenderedAmount,
              }),
            },
          });
        }
        await transaction.domainEvent.create({
          data: {
            aggregateId: order.id,
            aggregateType: 'order',
            organizationId,
            payload: {
              orderId: order.id,
              orderNumber: number,
              totalAmount,
              warehouseId: warehouse.id,
            },
            type: 'pos.sale-completed',
          },
        });
        const completed = await transaction.order.findUniqueOrThrow({
          where: { id: order.id },
          include: saleInclude,
        });
        return saleResponse(completed, prepared.cashChangeAmount, false);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrentReplay = await this.prisma.order.findUnique({
          where: {
            organizationId_checkoutIdempotencyKey: {
              checkoutIdempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: saleInclude,
        });
        if (concurrentReplay) {
          return saleReplay(concurrentReplay, prepared.requestHash);
        }
        throw new ConflictException('La referencia del pago ya está en uso');
      }
      throw error;
    }
  }
}

function prepareSale(dto: CreatePosSaleDto) {
  const variantIds = dto.items.map(({ variantId }) => variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new BadRequestException('Cada producto debe aparecer una sola vez');
  }
  const items = dto.items
    .map((item) => ({
      discountAmount: item.discountAmount ?? 0,
      quantity: item.quantity,
      variantId: item.variantId,
    }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
  const payments = dto.payments.map((payment) => {
    const provider = payment.provider.trim().toLowerCase();
    const externalReference = payment.externalReference?.trim() || null;
    const tenderedAmount = payment.tenderedAmount ?? payment.amount;
    if (
      payment.method === PaymentMethod.CASH &&
      tenderedAmount < payment.amount
    ) {
      throw new BadRequestException(
        'El monto recibido en efectivo no puede ser menor al monto aplicado',
      );
    }
    if (payment.method !== PaymentMethod.CASH && payment.tenderedAmount) {
      throw new BadRequestException(
        'tenderedAmount solo se utiliza para pagos en efectivo',
      );
    }
    return {
      amount: payment.amount,
      externalReference,
      method: payment.method,
      provider,
      tenderedAmount,
    };
  });
  const idempotencyKey = dto.idempotencyKey.trim();
  const discountAmount = dto.discountAmount ?? 0;
  const notes = dto.notes?.trim() || null;
  return {
    cashChangeAmount: payments.reduce(
      (sum, payment) =>
        sum +
        (payment.method === PaymentMethod.CASH
          ? payment.tenderedAmount - payment.amount
          : 0),
      0,
    ),
    discountAmount,
    idempotencyKey,
    items,
    notes,
    payments,
    requestHash: createRequestFingerprint({
      discountAmount,
      items,
      notes,
      payments,
      warehouseId: dto.warehouseId,
    }),
  };
}

function saleReplay(order: PosOrder, requestHash: string) {
  if (order.checkoutRequestHash !== requestHash) {
    throw new ConflictException(
      'La clave de idempotencia ya fue utilizada con una venta diferente',
    );
  }
  const cashChangeAmount = order.payments.reduce((sum, payment) => {
    const match = payment.notes?.match(/Monto recibido: (\d+) CLP/);
    return payment.method === PaymentMethod.CASH && match
      ? sum + Number(match[1]) - Number(payment.amount)
      : sum;
  }, 0);
  return saleResponse(order, cashChangeAmount, true);
}

function saleResponse(
  order: PosOrder,
  cashChangeAmount: number,
  idempotent: boolean,
) {
  const { checkoutRequestHash, ...safeOrder } = order;
  void checkoutRequestHash;
  return { cashChangeAmount, idempotent, order: safeOrder };
}

async function lockBalances(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  balanceIds: string[],
) {
  const uniqueIds = [...new Set(balanceIds)].sort();
  const balances = await transaction.$queryRaw<LockedBalance[]>(Prisma.sql`
    SELECT "id", "variantId", "physicalQuantity", "reservedQuantity"
    FROM "InventoryBalance"
    WHERE "organizationId" = ${organizationId}
      AND "id" IN (${Prisma.join(uniqueIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
  if (balances.length !== uniqueIds.length) {
    throw new ConflictException(
      'No se pudo bloquear el inventario de la venta',
    );
  }
  return balances;
}

function createPosOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `POS-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
