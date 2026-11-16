import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PasswordService } from '../src/auth/password.service';
import { provisionDefaultRbac } from '../src/auth/permissions';
import { InventoryMovementType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

interface Balance {
  id: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

interface Sale {
  idempotent: boolean;
  cashChangeAmount: number;
  order: { id: string; items: Array<{ id: string }>; payments: unknown[] };
}

describe('POS with real PostgreSQL (explicit isolated target only)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let token: string;
  let organizationId: string;
  let actorId: string;
  let warehouseId: string;
  let variantId: string;
  let balanceId: string;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const run = randomUUID();

  async function post<T>(
    route: string,
    body: object,
    status = 201,
  ): Promise<T> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1${route}`)
      .set('authorization', `Bearer ${token}`)
      .send(body)
      .expect(status);
    return response.body as T;
  }

  async function balance(): Promise<Balance> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/inventory/balances/${balanceId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    return response.body as Balance;
  }

  function sale(quantity = 1, idempotencyKey = randomUUID()) {
    return {
      warehouseId,
      idempotencyKey,
      items: [{ variantId, quantity }],
      payments: [
        {
          method: 'CASH',
          provider: 'synthetic-pos-test',
          amount: quantity * 1000,
        },
      ],
    };
  }

  async function businessCounts() {
    return {
      orders: await prisma.order.count({ where: { organizationId } }),
      items: await prisma.orderItem.count({ where: { organizationId } }),
      payments: await prisma.payment.count({ where: { organizationId } }),
      movements: await prisma.inventoryMovement.count({
        where: { organizationId },
      }),
      history: await prisma.orderStatusHistory.count({
        where: { organizationId },
      }),
      events: await prisma.domainEvent.count({ where: { organizationId } }),
    };
  }

  beforeAll(async () => {
    // Never fall back to DATABASE_URL or the commercial .env. No reset or seed.
    const raw = process.env.DATABASE_URL_TEST;
    if (!raw)
      throw new Error(
        'DATABASE_URL_TEST must explicitly select the isolated test database',
      );
    const target = new URL(raw);
    if (
      process.env.NODE_ENV !== 'test' ||
      target.hostname !== '127.0.0.1' ||
      target.port !== '55432' ||
      target.pathname !== '/dtodopets_stage1_test'
    ) {
      throw new Error(
        'Refusing PostgreSQL tests outside 127.0.0.1:55432/dtodopets_stage1_test',
      );
    }
    process.env.DATABASE_URL = raw;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    configureApp(app, { corsOrigins: [], nodeEnv: 'test', port: 0 });
    await app.init();
    prisma = app.get(PrismaService);
    const password = randomBytes(24).toString('hex');
    const passwordHash = await app.get(PasswordService).hash(password);
    const slug = `pos-test-${run}`;
    const email = `owner-${run}@example.invalid`;
    const identity = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: 'Synthetic POS regression', slug },
      });
      const roles = await provisionDefaultRbac(tx, organization.id);
      const ownerRole = roles.get('owner');
      if (!ownerRole) throw new Error('Missing synthetic Owner role');
      const user = await tx.user.create({
        data: {
          email,
          firstName: 'Synthetic',
          passwordHash,
          organizationId: organization.id,
          roles: { create: { roleId: ownerRole } },
        },
      });
      return { organization, user };
    });
    organizationId = identity.organization.id;
    actorId = identity.user.id;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, organizationSlug: slug, password })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;
    const location = await post<{ id: string }>('/locations', {
      name: `Synthetic branch ${run}`,
    });
    warehouseId = (
      await post<{ id: string }>('/warehouses', {
        name: 'Synthetic POS warehouse',
        locationId: location.id,
      })
    ).id;
  });

  beforeEach(async () => {
    if (!app) return;
    const id = randomUUID();
    const product = await post<{ variants: Array<{ id: string }> }>(
      '/products',
      {
        name: `Synthetic POS product ${id}`,
        variants: [{ sku: `TEST-${id}`, costAmount: 500, priceAmount: 1000 }],
      },
    );
    variantId = product.variants[0].id;
    const received = await post<{ balance: Balance }>(
      '/inventory/adjustments',
      {
        warehouseId,
        variantId,
        quantityDelta: 10,
        reason: 'Synthetic receipt for POS regression',
      },
    );
    balanceId = received.balance.id;
  });

  afterAll(async () => {
    if (app) await app.close();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  it('sells one of ten units, recording a payment, SALE movement and origin', async () => {
    const result = await post<Sale>('/pos/sales', sale());
    expect(await balance()).toMatchObject({
      physicalQuantity: 9,
      reservedQuantity: 0,
      availableQuantity: 9,
    });
    expect(result.order.payments).toHaveLength(1);
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { balanceId, type: InventoryMovementType.SALE },
    });
    expect(movement).toMatchObject({
      organizationId,
      actorUserId: actorId,
      physicalBefore: 10,
      physicalAfter: 9,
      physicalDelta: -1,
      reservedBefore: 0,
      reservedAfter: 0,
      reservedDelta: 0,
      referenceType: 'order-item',
      referenceId: result.order.items[0].id,
    });
    expect(movement.createdAt).toBeInstanceOf(Date);
    expect(movement.operationId).toBeTruthy();
  });

  it('sells several units with split payments and exact stock deduction', async () => {
    const result = await post<Sale>('/pos/sales', {
      ...sale(4),
      payments: [
        {
          method: 'CASH',
          provider: 'synthetic-cash',
          amount: 1500,
          tenderedAmount: 2000,
        },
        { method: 'DEBIT_CARD', provider: 'synthetic-card', amount: 2500 },
      ],
    });
    expect(result.cashChangeAmount).toBe(500);
    expect(result.order.payments).toHaveLength(2);
    expect(await balance()).toMatchObject({
      physicalQuantity: 6,
      reservedQuantity: 0,
      availableQuantity: 6,
    });
  });

  it('rejects overselling and leaves all business records unchanged', async () => {
    const before = await businessCounts();
    await post('/pos/sales', sale(11), 409);
    expect(await businessCounts()).toEqual(before);
    expect((await balance()).physicalQuantity).toBe(10);
  });

  it('preserves other orders reservations and rejects selling reserved units', async () => {
    const reservation = await post<{ reservation: { id: string } }>(
      '/inventory/reservations',
      {
        warehouseId,
        variantId,
        quantity: 3,
        reason: 'Synthetic external commitment',
        referenceType: 'synthetic-test',
        referenceId: randomUUID(),
      },
    );
    await post('/pos/sales', sale(2));
    expect(await balance()).toMatchObject({
      physicalQuantity: 8,
      reservedQuantity: 3,
      availableQuantity: 5,
    });
    await post('/pos/sales', sale(6), 409);
    await post(
      `/inventory/reservations/${reservation.reservation.id}/release`,
      { reason: 'Synthetic cancellation' },
    );
    const replay = await post<{ idempotent: boolean }>(
      `/inventory/reservations/${reservation.reservation.id}/release`,
      { reason: 'Repeated synthetic cancellation' },
    );
    expect(replay.idempotent).toBe(true);
    expect(await balance()).toMatchObject({
      physicalQuantity: 8,
      reservedQuantity: 0,
      availableQuantity: 8,
    });
  });

  it('replays a sale without duplicating order, payment, event or movement', async () => {
    const input = sale(2);
    const original = await post<Sale>('/pos/sales', input);
    const before = await businessCounts();
    const replay = await post<Sale>('/pos/sales', input);
    expect(replay.idempotent).toBe(true);
    expect(replay.order.id).toBe(original.order.id);
    expect(await businessCounts()).toEqual(before);
    expect((await balance()).physicalQuantity).toBe(8);
    await post(
      '/pos/sales',
      {
        ...input,
        items: [{ variantId, quantity: 1 }],
        payments: sale().payments,
      },
      409,
    );
    expect(await businessCounts()).toEqual(before);
  });

  it('allows only one of two concurrent sales for the last unit', async () => {
    await post('/inventory/adjustments', {
      warehouseId,
      variantId,
      quantityDelta: -9,
      reason: 'Prepare synthetic last unit',
    });
    const before = await businessCounts();
    const responses = await Promise.all(
      [sale(), sale()].map((input) =>
        request(app.getHttpServer())
          .post('/api/v1/pos/sales')
          .set('authorization', `Bearer ${token}`)
          .send(input),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await balance()).toMatchObject({
      physicalQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    });
    const after = await businessCounts();
    expect(after.orders - before.orders).toBe(1);
    expect(after.payments - before.payments).toBe(1);
    expect(after.movements - before.movements).toBe(1);
  });

  it('replays concurrent copies of the same sale even when it consumes the last unit', async () => {
    await post('/inventory/adjustments', {
      warehouseId,
      variantId,
      quantityDelta: -9,
      reason: 'Prepare synthetic last unit replay',
    });
    const input = sale();
    const before = await businessCounts();
    const results = await Promise.all([
      post<Sale>('/pos/sales', input),
      post<Sale>('/pos/sales', input),
    ]);
    expect(results[0].order.id).toBe(results[1].order.id);
    expect(results.filter((result) => result.idempotent)).toHaveLength(1);
    const after = await businessCounts();
    expect(after.orders - before.orders).toBe(1);
    expect(after.payments - before.payments).toBe(1);
    expect(after.movements - before.movements).toBe(1);
  });

  it('rolls back a late payment error including prior payment, order, stock, history and outbox', async () => {
    const input = sale();
    const reference = randomUUID();
    const before = await businessCounts();
    await post(
      '/pos/sales',
      {
        ...input,
        payments: [
          {
            method: 'DEBIT_CARD',
            provider: 'synthetic-rollback',
            amount: 500,
            externalReference: reference,
          },
          {
            method: 'DEBIT_CARD',
            provider: 'synthetic-rollback',
            amount: 500,
            externalReference: reference,
          },
        ],
      },
      409,
    );
    expect(await businessCounts()).toEqual(before);
    expect((await balance()).physicalQuantity).toBe(10);
    // The failed transaction must not consume the idempotency key.
    await post('/pos/sales', input);
    expect((await balance()).physicalQuantity).toBe(9);
  });

  it('rejects a variant or warehouse from another organization', async () => {
    const other = await prisma.organization.create({
      data: { name: 'Synthetic other tenant', slug: `other-${randomUUID()}` },
    });
    const otherWarehouse = await prisma.warehouse.create({
      data: { name: 'Other synthetic warehouse', organizationId: other.id },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Other synthetic product',
        slug: 'other-product',
        organizationId: other.id,
        variants: {
          create: {
            sku: 'OTHER',
            costAmount: 500,
            priceAmount: 1000,
          },
        },
      },
      include: { variants: true },
    });
    const before = await businessCounts();
    await post(
      '/pos/sales',
      { ...sale(), warehouseId: otherWarehouse.id },
      400,
    );
    await post(
      '/pos/sales',
      {
        ...sale(),
        items: [{ variantId: product.variants[0].id, quantity: 1 }],
      },
      400,
    );
    expect(await businessCounts()).toEqual(before);
    expect((await balance()).physicalQuantity).toBe(10);
  });

  it('keeps SQL checks for SALE and COMMIT and the immutable ledger trigger', async () => {
    const data = {
      id: randomUUID(),
      organizationId,
      balanceId,
      actorUserId: actorId,
      operationId: randomUUID(),
      reason: 'Synthetic invalid movement',
      physicalBefore: 10,
      physicalAfter: 9,
      physicalDelta: -1,
    };
    await expect(
      prisma.inventoryMovement.create({
        data: {
          ...data,
          type: InventoryMovementType.SALE,
          reservedBefore: 1,
          reservedAfter: 0,
          reservedDelta: -1,
        },
      }),
    ).rejects.toThrow('InventoryMovement_delta_matches_type');
    await expect(
      prisma.inventoryMovement.create({
        data: {
          ...data,
          id: randomUUID(),
          type: InventoryMovementType.COMMIT,
          reservedBefore: 0,
          reservedAfter: 0,
          reservedDelta: 0,
        },
      }),
    ).rejects.toThrow('InventoryMovement_delta_matches_type');
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { balanceId },
    });
    await expect(
      prisma.inventoryMovement.update({
        where: { id: movement.id },
        data: { reason: 'Attempted synthetic rewrite' },
      }),
    ).rejects.toThrow('append-only');
    await expect(
      prisma.inventoryBalance.update({
        where: { id: balanceId },
        data: { physicalQuantity: -1 },
      }),
    ).rejects.toThrow('InventoryBalance_physical_nonnegative');
    expect((await balance()).physicalQuantity).toBe(10);
  });

  it('keeps legacy order reservation/COMMIT semantics and replays confirmation', async () => {
    const customer = await post<{ id: string }>('/customers', {
      name: 'Synthetic historical-contract customer',
    });
    const address = await post<{ id: string }>(
      `/customers/${customer.id}/addresses`,
      {
        label: 'Synthetic',
        addressLine1: 'Synthetic address',
        commune: 'Synthetic',
        city: 'Synthetic',
        region: 'Synthetic',
      },
    );
    const created = await post<{ id: string }>('/orders', {
      customerId: customer.id,
      customerAddressId: address.id,
      warehouseId,
      items: [{ variantId, quantity: 2 }],
    });
    expect(await balance()).toMatchObject({
      physicalQuantity: 10,
      reservedQuantity: 2,
      availableQuantity: 8,
    });
    await post(`/orders/${created.id}/confirm`, {
      reason: 'Synthetic legacy confirmation',
    });
    expect(await balance()).toMatchObject({
      physicalQuantity: 8,
      reservedQuantity: 0,
      availableQuantity: 8,
    });
    const commit = await prisma.inventoryMovement.findFirstOrThrow({
      where: { balanceId, type: InventoryMovementType.COMMIT },
    });
    expect(commit).toMatchObject({ physicalDelta: -2, reservedDelta: -2 });
    const before = await businessCounts();
    await post(`/orders/${created.id}/confirm`, {
      reason: 'Synthetic confirmation replay',
    });
    expect(await businessCounts()).toEqual(before);
  });

  it('keeps transfers and legacy reserved-order returns working alongside direct sales', async () => {
    const destination = await post<{ id: string }>('/warehouses', {
      name: `Synthetic transfer destination ${randomUUID()}`,
    });
    await post('/inventory/transfers', {
      sourceWarehouseId: warehouseId,
      destinationWarehouseId: destination.id,
      variantId,
      quantity: 2,
      reason: 'Synthetic compatibility transfer',
    });
    expect((await balance()).physicalQuantity).toBe(8);
    await post<Sale>('/pos/sales', sale(2));
    const customer = await post<{ id: string }>('/customers', {
      name: 'Synthetic legacy-return customer',
    });
    const address = await post<{ id: string }>(
      `/customers/${customer.id}/addresses`,
      {
        label: 'Synthetic',
        addressLine1: 'Synthetic address',
        commune: 'Synthetic',
        city: 'Synthetic',
        region: 'Synthetic',
      },
    );
    const legacyOrder = await post<{
      id: string;
      items: Array<{ id: string }>;
    }>('/orders', {
      customerId: customer.id,
      customerAddressId: address.id,
      warehouseId,
      items: [{ variantId, quantity: 2 }],
    });
    await post(`/orders/${legacyOrder.id}/confirm`, {
      reason: 'Synthetic legacy-return confirmation',
    });
    const body = {
      orderId: legacyOrder.id,
      items: [
        { orderItemId: legacyOrder.items[0].id, quantity: 1, restock: true },
      ],
      reason: 'Synthetic legacy return',
      idempotencyKey: randomUUID(),
    };
    await post('/returns', body);
    const before = await businessCounts();
    await post('/returns', body);
    expect(await businessCounts()).toEqual(before);
    expect((await balance()).physicalQuantity).toBe(5);
    expect(
      await prisma.inventoryMovement.count({
        where: { balanceId, type: InventoryMovementType.RETURN },
      }),
    ).toBe(1);
  });
});
