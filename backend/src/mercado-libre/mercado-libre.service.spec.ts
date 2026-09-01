import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { Prisma } from '../generated/prisma/client';
import { MercadoLibreService } from './mercado-libre.service';

describe('MercadoLibreService', () => {
  function setup() {
    const tx = {
      domainEvent: { create: jest.fn().mockResolvedValue({ id: 'event-a' }) },
      externalReference: {
        create: jest.fn().mockResolvedValue({ id: 'ref-a' }),
      },
      mercadoLibreListing: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({
          availableQuantity: 5,
          id: 'listing-a',
          integrationId: 'integration-a',
          variantId: 'variant-a',
        }),
      },
      webhookReceipt: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
      externalReference: { findUnique: jest.fn() },
      integration: { findFirst: jest.fn(), findUnique: jest.fn() },
      mercadoLibreListing: { findMany: jest.fn(), findUnique: jest.fn() },
      order: { findFirst: jest.fn() },
      productVariant: { findFirst: jest.fn() },
      webhookReceipt: { findUnique: jest.fn() },
    };
    const orders = { create: jest.fn() };
    const service = new MercadoLibreService(prisma as never, orders as never);
    return { orders, prisma, service, tx };
  }

  it('upserts a tenant-scoped listing snapshot and emits an event', async () => {
    const { prisma, service, tx } = setup();
    prisma.integration.findFirst.mockResolvedValue({ id: 'integration-a' });
    prisma.productVariant.findFirst.mockResolvedValue({ id: 'variant-a' });

    await service.upsertListing('org-a', 'integration-a', {
      availableQuantity: 5,
      externalItemId: 'MLC-1',
      feeAmount: 500,
      listingPriceAmount: 14990,
      variantId: 'variant-a',
    });

    expect(tx.mercadoLibreListing.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          feeAmount: new Prisma.Decimal(500),
          organizationId: 'org-a',
        }) as object,
      }),
    );
    expect(tx.domainEvent.create).toHaveBeenCalled();
  });

  it('replays an already imported external order without reserving again', async () => {
    const { orders, prisma, service } = setup();
    prisma.integration.findFirst.mockResolvedValue({ id: 'integration-a' });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-a',
      sourceRequestHash: createRequestFingerprint({
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        discountAmount: 0,
        externalOrderId: '2000001',
        items: [
          {
            discountAmount: 0,
            externalItemId: 'MLC-1',
            externalVariationId: '',
            quantity: 1,
          },
        ],
        notes: null,
        shippingAmount: 0,
        warehouseId: 'warehouse-a',
      }),
    });
    prisma.externalReference.findUnique.mockResolvedValue({
      entityId: 'order-a',
    });

    const result = await service.importOrder(
      'org-a',
      'user-a',
      'integration-a',
      {
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        externalOrderId: '2000001',
        items: [{ externalItemId: 'MLC-1', quantity: 1 }],
        warehouseId: 'warehouse-a',
      },
    );

    expect(result.idempotent).toBe(true);
    expect(result.order).not.toHaveProperty('sourceRequestHash');
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of an external order ID with a different payload', async () => {
    const { orders, prisma, service } = setup();
    prisma.integration.findFirst.mockResolvedValue({ id: 'integration-a' });
    prisma.order.findFirst.mockResolvedValue({
      id: 'order-a',
      sourceRequestHash: 'a'.repeat(64),
    });

    await expect(
      service.importOrder('org-a', 'user-a', 'integration-a', {
        customerAddressId: 'address-a',
        customerId: 'customer-a',
        externalOrderId: '2000001',
        items: [{ externalItemId: 'MLC-1', quantity: 2 }],
        warehouseId: 'warehouse-a',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orders.create).not.toHaveBeenCalled();
  });

  it('accepts an allowlisted Mercado Libre source and records the webhook once', async () => {
    const { prisma, service, tx } = setup();
    prisma.integration.findUnique.mockResolvedValue({
      active: true,
      config: {
        applicationId: 456,
        sellerId: 123,
        webhookAllowedIps: ['127.0.0.1'],
      },
      organizationId: 'org-a',
      provider: 'mercado-libre',
    });
    prisma.webhookReceipt.findUnique.mockResolvedValue(null);
    tx.webhookReceipt.create.mockResolvedValue({
      id: 'receipt-a',
      payloadHash: 'a'.repeat(64),
    });

    const result = await service.receiveWebhook(
      'integration-a',
      '::ffff:127.0.0.1',
      {
        _id: 'event-a',
        application_id: 456,
        resource: '/orders/123',
        topic: 'orders',
        user_id: 123,
      },
    );

    expect(result.idempotent).toBe(false);
    expect(tx.webhookReceipt.create).toHaveBeenCalled();
  });

  it('rejects a webhook from a source outside the configured allowlist', async () => {
    const { prisma, service } = setup();
    prisma.integration.findUnique.mockResolvedValue({
      active: true,
      config: {
        applicationId: 456,
        sellerId: 123,
        webhookAllowedIps: ['127.0.0.1'],
      },
      organizationId: 'org-a',
      provider: 'mercado-libre',
    });

    await expect(
      service.receiveWebhook('integration-a', '203.0.113.10', {
        _id: 'event-a',
        application_id: 456,
        resource: '/orders/123',
        topic: 'orders',
        user_id: 123,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a notification for another Mercado Libre seller', async () => {
    const { prisma, service } = setup();
    prisma.integration.findUnique.mockResolvedValue({
      active: true,
      config: {
        applicationId: 456,
        sellerId: 999,
        webhookAllowedIps: ['127.0.0.1'],
      },
      organizationId: 'org-a',
      provider: 'mercado-libre',
    });

    await expect(
      service.receiveWebhook('integration-a', '127.0.0.1', {
        _id: 'event-a',
        application_id: 456,
        resource: '/orders/123',
        topic: 'orders',
        user_id: 123,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
