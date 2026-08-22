import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { toClpDecimal } from '../common/money/clp';
import { createPage, getPagination } from '../common/pagination/pagination';
import { OrderStatus, PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

const actorSelect = {
  email: true,
  firstName: true,
  id: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const paymentInclude = {
  createdBy: { select: actorSelect },
  order: {
    select: {
      customer: { select: { id: true, name: true } },
      id: true,
      number: true,
      status: true,
      totalAmount: true,
    },
  },
  refunds: {
    include: { createdBy: { select: actorSelect } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.PaymentInclude;

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

interface LockedOrder {
  id: string;
  status: OrderStatus;
  totalAmount: string;
}

interface LockedPayment {
  amount: string;
  id: string;
  orderId: string;
  status: PaymentStatus;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, query: PaymentQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      method: query.method,
      orderId: query.orderId,
      organizationId,
      status: query.status,
      ...(search
        ? {
            OR: [
              { provider: { contains: search, mode: 'insensitive' } },
              {
                externalReference: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                order: {
                  is: { number: { contains: search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: paymentInclude,
        ...getPagination(query),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.payment.count({ where }),
    ]);
    return createPage(data.map(toPaymentView), total, query);
  }

  async findOne(organizationId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, organizationId },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return toPaymentView(payment);
  }

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreatePaymentDto,
  ) {
    const prepared = preparePayment(dto);
    const replay = await this.prisma.payment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          idempotencyKey: prepared.idempotencyKey,
          organizationId,
        },
      },
      include: paymentInclude,
    });
    if (replay) return paymentReplay(replay, prepared.requestHash);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const order = await lockPayableOrder(
          transaction,
          organizationId,
          dto.orderId,
        );
        const concurrentReplay = await transaction.payment.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: paymentInclude,
        });
        if (concurrentReplay) {
          return paymentReplay(concurrentReplay, prepared.requestHash);
        }

        const captured = await transaction.payment.aggregate({
          where: { orderId: dto.orderId, organizationId },
          _sum: { amount: true },
        });
        const refunded = await transaction.paymentRefund.aggregate({
          where: {
            organizationId,
            payment: { is: { orderId: dto.orderId } },
          },
          _sum: { amount: true },
        });
        const grossAmount = captured._sum.amount ?? new Prisma.Decimal(0);
        const refundedAmount = refunded._sum.amount ?? new Prisma.Decimal(0);
        const outstandingAmount = new Prisma.Decimal(order.totalAmount).minus(
          grossAmount.minus(refundedAmount),
        );
        const amount = toClpDecimal(dto.amount);
        if (outstandingAmount.lessThan(amount)) {
          throw new ConflictException(
            'Payment exceeds order outstanding amount',
          );
        }

        const payment = await transaction.payment.create({
          data: {
            amount,
            createdByUserId: actorUserId,
            externalReference: prepared.externalReference,
            idempotencyKey: prepared.idempotencyKey,
            method: dto.method,
            notes: prepared.notes,
            orderId: dto.orderId,
            organizationId,
            provider: prepared.provider,
            requestHash: prepared.requestHash,
          },
          include: paymentInclude,
        });
        return { idempotent: false, payment: toPaymentView(payment) };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.prisma.payment.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          include: paymentInclude,
        });
        if (concurrentReplay) {
          return paymentReplay(concurrentReplay, prepared.requestHash);
        }
        throw new ConflictException('Payment reference is already in use');
      }
      throw error;
    }
  }

  async refund(
    organizationId: string,
    actorUserId: string,
    paymentId: string,
    dto: CreateRefundDto,
  ) {
    const prepared = prepareRefund(paymentId, dto);
    const replay = await this.prisma.paymentRefund.findUnique({
      where: {
        organizationId_idempotencyKey: {
          idempotencyKey: prepared.idempotencyKey,
          organizationId,
        },
      },
      select: { id: true, paymentId: true, requestHash: true },
    });
    if (replay) {
      return this.refundReplay(organizationId, replay, prepared.requestHash);
    }

    const paymentReference = await this.prisma.payment.findFirst({
      where: { id: paymentId, organizationId },
      select: { orderId: true },
    });
    if (!paymentReference) throw new NotFoundException('Payment not found');

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await lockOrder(transaction, organizationId, paymentReference.orderId);
        const payment = await lockPayment(
          transaction,
          organizationId,
          paymentId,
        );
        const concurrentReplay = await transaction.paymentRefund.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          select: { id: true, paymentId: true, requestHash: true },
        });
        if (concurrentReplay) {
          return this.refundReplay(
            organizationId,
            concurrentReplay,
            prepared.requestHash,
            transaction,
          );
        }

        const aggregate = await transaction.paymentRefund.aggregate({
          where: { paymentId, organizationId },
          _sum: { amount: true },
        });
        const refunded = aggregate._sum.amount ?? new Prisma.Decimal(0);
        const amount = toClpDecimal(dto.amount);
        const paymentAmount = new Prisma.Decimal(payment.amount);
        const nextRefunded = refunded.plus(amount);
        if (nextRefunded.greaterThan(paymentAmount)) {
          throw new ConflictException('Refund exceeds payment amount');
        }

        const refund = await transaction.paymentRefund.create({
          data: {
            amount,
            createdByUserId: actorUserId,
            externalReference: prepared.externalReference,
            idempotencyKey: prepared.idempotencyKey,
            organizationId,
            paymentId,
            reason: prepared.reason,
            requestHash: prepared.requestHash,
          },
        });
        await transaction.payment.update({
          where: { id: paymentId },
          data: {
            status: nextRefunded.equals(paymentAmount)
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED,
          },
        });
        return {
          idempotent: false,
          payment: toPaymentView(
            await getPaymentOrThrow(transaction, paymentId),
          ),
          refund: toRefundView(refund),
        };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrentReplay = await this.prisma.paymentRefund.findUnique({
          where: {
            organizationId_idempotencyKey: {
              idempotencyKey: prepared.idempotencyKey,
              organizationId,
            },
          },
          select: { id: true, paymentId: true, requestHash: true },
        });
        if (concurrentReplay) {
          return this.refundReplay(
            organizationId,
            concurrentReplay,
            prepared.requestHash,
          );
        }
        throw new ConflictException('Refund reference is already in use');
      }
      throw error;
    }
  }

  private async refundReplay(
    organizationId: string,
    refund: { id: string; paymentId: string; requestHash: string },
    requestHash: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    if (refund.requestHash !== requestHash) {
      throw new ConflictException(
        'Idempotency key was already used with different refund data',
      );
    }
    const payment = await client.payment.findFirst({
      where: { id: refund.paymentId, organizationId },
      include: paymentInclude,
    });
    const fullRefund = payment?.refunds.find(({ id }) => id === refund.id);
    if (!payment || !fullRefund) {
      throw new NotFoundException('Refund not found');
    }
    return {
      idempotent: true,
      payment: toPaymentView(payment),
      refund: toRefundView(fullRefund),
    };
  }
}

function preparePayment(dto: CreatePaymentDto) {
  const provider = requiredText(dto.provider).toLowerCase();
  const externalReference = optionalText(dto.externalReference);
  const idempotencyKey = requiredText(dto.idempotencyKey);
  const notes = optionalText(dto.notes);
  return {
    externalReference,
    idempotencyKey,
    notes,
    provider,
    requestHash: createRequestFingerprint({
      amount: dto.amount,
      externalReference,
      method: dto.method,
      orderId: dto.orderId,
      provider,
    }),
  };
}

function prepareRefund(paymentId: string, dto: CreateRefundDto) {
  const externalReference = optionalText(dto.externalReference);
  const idempotencyKey = requiredText(dto.idempotencyKey);
  const reason = requiredText(dto.reason);
  return {
    externalReference,
    idempotencyKey,
    reason,
    requestHash: createRequestFingerprint({
      amount: dto.amount,
      externalReference,
      paymentId,
      reason,
    }),
  };
}

function paymentReplay(payment: PaymentWithRelations, requestHash: string) {
  if (payment.requestHash !== requestHash) {
    throw new ConflictException(
      'Idempotency key was already used with different payment data',
    );
  }
  return { idempotent: true, payment: toPaymentView(payment) };
}

function toPaymentView(payment: PaymentWithRelations) {
  const refundedAmount = payment.refunds.reduce(
    (total, refund) => total.plus(refund.amount),
    new Prisma.Decimal(0),
  );
  const { requestHash, ...safePayment } = payment;
  void requestHash;
  return {
    ...safePayment,
    refunds: payment.refunds.map(toRefundView),
    refundedAmount,
    netAmount: payment.amount.minus(refundedAmount),
  };
}

function toRefundView<T extends { requestHash: string }>(refund: T) {
  const { requestHash, ...safeRefund } = refund;
  void requestHash;
  return safeRefund;
}

async function lockPayableOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const order = await lockOrder(transaction, organizationId, orderId);
  if (
    order.status !== OrderStatus.CONFIRMED &&
    order.status !== OrderStatus.COMPLETED
  ) {
    throw new ConflictException(
      'Payments require a confirmed or completed order',
    );
  }
  return order;
}

async function lockOrder(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  orderId: string,
) {
  const [order] = await transaction.$queryRaw<LockedOrder[]>(Prisma.sql`
    SELECT "id", "status", CAST("totalAmount" AS TEXT) AS "totalAmount"
    FROM "Order"
    WHERE "organizationId" = ${organizationId} AND "id" = ${orderId}
    FOR UPDATE
  `);
  if (!order) throw new NotFoundException('Order not found');
  return order;
}

async function lockPayment(
  transaction: Prisma.TransactionClient,
  organizationId: string,
  paymentId: string,
) {
  const [payment] = await transaction.$queryRaw<LockedPayment[]>(Prisma.sql`
    SELECT "id", "orderId", "status", CAST("amount" AS TEXT) AS "amount"
    FROM "Payment"
    WHERE "organizationId" = ${organizationId} AND "id" = ${paymentId}
    FOR UPDATE
  `);
  if (!payment) throw new NotFoundException('Payment not found');
  return payment;
}

function getPaymentOrThrow(
  transaction: Prisma.TransactionClient,
  paymentId: string,
) {
  return transaction.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: paymentInclude,
  });
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
