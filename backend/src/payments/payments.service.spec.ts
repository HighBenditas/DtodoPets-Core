import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

function payment(requestHash = 'a'.repeat(64), amount = 1000) {
  return {
    amount: new Prisma.Decimal(amount),
    createdAt: new Date(),
    createdBy: {
      email: 'admin@example.com',
      firstName: 'Admin',
      id: 'user-a',
      lastName: null,
    },
    createdByUserId: 'user-a',
    currency: 'CLP',
    externalReference: 'pay-ext-1',
    id: 'payment-a',
    idempotencyKey: 'pay-key-1',
    method: PaymentMethod.CREDIT_CARD,
    notes: null,
    order: {
      customer: { id: 'customer-a', name: 'Cliente' },
      id: 'order-a',
      number: 'ORD-1',
      status: OrderStatus.CONFIRMED,
      totalAmount: new Prisma.Decimal(1000),
    },
    orderId: 'order-a',
    organizationId: 'org-a',
    provider: 'transbank',
    refunds: [],
    requestHash,
    status: PaymentStatus.CAPTURED,
    updatedAt: new Date(),
  };
}

function transactionMock() {
  return {
    $queryRaw: jest.fn(),
    payment: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    paymentRefund: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: {
    $transaction: jest.Mock;
    payment: {
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    paymentRefund: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      payment: {
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      paymentRefund: { findUnique: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  it('does not expose a payment from another tenant', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.findOne('org-a', 'payment-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-b', organizationId: 'org-a' },
      }),
    );
  });

  it('captures a payment only up to the net outstanding amount', async () => {
    const transaction = transactionMock();
    prisma.payment.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', status: OrderStatus.CONFIRMED, totalAmount: '1000' },
    ]);
    transaction.payment.findUnique.mockResolvedValue(null);
    transaction.payment.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(200) },
    });
    transaction.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(100) },
    });
    transaction.payment.create.mockImplementation(
      (input: { data: { amount: Prisma.Decimal; requestHash: string } }) =>
        Promise.resolve({
          ...payment(input.data.requestHash, Number(input.data.amount)),
          id: 'payment-b',
        }),
    );
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.create('org-a', 'user-a', {
      amount: 900,
      externalReference: 'pay-ext-2',
      idempotencyKey: 'pay-key-2',
      method: PaymentMethod.CREDIT_CARD,
      orderId: 'order-a',
      provider: ' Transbank ',
    });

    expect(result.idempotent).toBe(false);
    expect(transaction.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(900),
          organizationId: 'org-a',
          provider: 'transbank',
        }) as object,
      }),
    );
  });

  it('rejects a payment above the order outstanding amount', async () => {
    const transaction = transactionMock();
    prisma.payment.findUnique.mockResolvedValue(null);
    transaction.$queryRaw.mockResolvedValue([
      { id: 'order-a', status: OrderStatus.CONFIRMED, totalAmount: '1000' },
    ]);
    transaction.payment.findUnique.mockResolvedValue(null);
    transaction.payment.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(800) },
    });
    transaction.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(0) },
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    await expect(
      service.create('org-a', 'user-a', {
        amount: 201,
        idempotencyKey: 'pay-key-2',
        method: PaymentMethod.CASH,
        orderId: 'order-a',
        provider: 'manual',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.payment.create).not.toHaveBeenCalled();
  });

  it('replays the same payment key and rejects different data', async () => {
    const requestHash = createRequestFingerprint({
      amount: 1000,
      externalReference: 'pay-ext-1',
      method: PaymentMethod.CREDIT_CARD,
      orderId: 'order-a',
      provider: 'transbank',
    });
    prisma.payment.findUnique.mockResolvedValue(payment(requestHash));

    const replay = await service.create('org-a', 'user-a', {
      amount: 1000,
      externalReference: 'pay-ext-1',
      idempotencyKey: 'pay-key-1',
      method: PaymentMethod.CREDIT_CARD,
      orderId: 'order-a',
      provider: 'transbank',
    });
    expect(replay.idempotent).toBe(true);

    await expect(
      service.create('org-a', 'user-a', {
        amount: 999,
        externalReference: 'pay-ext-1',
        idempotencyKey: 'pay-key-1',
        method: PaymentMethod.CREDIT_CARD,
        orderId: 'order-a',
        provider: 'transbank',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('partially refunds a captured payment and updates its status', async () => {
    const transaction = transactionMock();
    prisma.paymentRefund.findUnique.mockResolvedValue(null);
    prisma.payment.findFirst.mockResolvedValue({ orderId: 'order-a' });
    transaction.$queryRaw
      .mockResolvedValueOnce([
        { id: 'order-a', status: OrderStatus.CONFIRMED, totalAmount: '1000' },
      ])
      .mockResolvedValueOnce([
        {
          amount: '1000',
          id: 'payment-a',
          orderId: 'order-a',
          status: PaymentStatus.CAPTURED,
        },
      ]);
    transaction.paymentRefund.findUnique.mockResolvedValue(null);
    transaction.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(100) },
    });
    transaction.paymentRefund.create.mockImplementation(
      (input: { data: { requestHash: string } }) =>
        Promise.resolve({
          amount: new Prisma.Decimal(200),
          createdAt: new Date(),
          createdByUserId: 'user-a',
          currency: 'CLP',
          externalReference: null,
          id: 'refund-a',
          idempotencyKey: 'refund-key-1',
          organizationId: 'org-a',
          paymentId: 'payment-a',
          reason: 'Ajuste comercial',
          requestHash: input.data.requestHash,
        }),
    );
    transaction.payment.findUniqueOrThrow.mockImplementation(() => {
      const refundRow = {
        amount: new Prisma.Decimal(200),
        createdAt: new Date(),
        createdBy: payment().createdBy,
        createdByUserId: 'user-a',
        currency: 'CLP',
        externalReference: null,
        id: 'refund-a',
        idempotencyKey: 'refund-key-1',
        organizationId: 'org-a',
        paymentId: 'payment-a',
        reason: 'Ajuste comercial',
        requestHash: 'b'.repeat(64),
      };
      return Promise.resolve({
        ...payment('a'.repeat(64)),
        refunds: [refundRow],
        status: PaymentStatus.PARTIALLY_REFUNDED,
      });
    });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    );

    const result = await service.refund('org-a', 'user-a', 'payment-a', {
      amount: 200,
      idempotencyKey: 'refund-key-1',
      reason: 'Ajuste comercial',
    });

    expect(result.idempotent).toBe(false);
    expect(transaction.payment.update).toHaveBeenCalledWith({
      data: { status: PaymentStatus.PARTIALLY_REFUNDED },
      where: { id: 'payment-a' },
    });
  });
});
