import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { toClpDecimal } from '../common/money/clp';
import { ExternalEntityType, Prisma } from '../generated/prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MercadoLibreImportOrderDto,
  MercadoLibreListingDto,
  MercadoLibreWebhookDto,
} from './dto/mercado-libre.dto';

const provider = 'mercado-libre';

@Injectable()
export class MercadoLibreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async findListings(organizationId: string, integrationId: string) {
    await this.integration(organizationId, integrationId);
    return this.prisma.mercadoLibreListing.findMany({
      where: { integrationId, organizationId },
      include: {
        variant: {
          select: {
            id: true,
            sku: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async upsertListing(
    organizationId: string,
    integrationId: string,
    dto: MercadoLibreListingDto,
  ) {
    await this.integration(organizationId, integrationId);
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.variantId, organizationId },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Product variant not found');
    const externalItemId = dto.externalItemId.trim();
    const externalVariationId = dto.externalVariationId?.trim() ?? '';
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.mercadoLibreListing.findUnique({
          where: {
            integrationId_externalItemId_externalVariationId: {
              externalItemId,
              externalVariationId,
              integrationId,
            },
          },
          select: { variantId: true },
        });
        if (current && current.variantId !== dto.variantId) {
          throw new ConflictException(
            'Mercado Libre listing mapping is already in use',
          );
        }
        const listing = await tx.mercadoLibreListing.upsert({
          where: {
            integrationId_externalItemId_externalVariationId: {
              externalItemId,
              externalVariationId,
              integrationId,
            },
          },
          create: {
            availableQuantity: dto.availableQuantity,
            externalItemId,
            externalVariationId,
            feeAmount:
              dto.feeAmount === undefined
                ? undefined
                : toClpDecimal(dto.feeAmount),
            integrationId,
            lastSyncedAt: new Date(),
            listingPriceAmount:
              dto.listingPriceAmount === undefined
                ? undefined
                : toClpDecimal(dto.listingPriceAmount),
            metadata: json(dto.metadata),
            organizationId,
            variantId: dto.variantId,
          },
          update: {
            availableQuantity: dto.availableQuantity,
            externalItemId,
            externalVariationId,
            feeAmount:
              dto.feeAmount === undefined
                ? undefined
                : toClpDecimal(dto.feeAmount),
            lastSyncedAt: new Date(),
            listingPriceAmount:
              dto.listingPriceAmount === undefined
                ? undefined
                : toClpDecimal(dto.listingPriceAmount),
            metadata: json(dto.metadata),
          },
        });
        await tx.domainEvent.create({
          data: {
            aggregateId: listing.id,
            aggregateType: 'mercado-libre-listing',
            integrationId,
            organizationId,
            payload: {
              availableQuantity: listing.availableQuantity,
              externalItemId,
              listingId: listing.id,
              variantId: listing.variantId,
            },
            type: 'mercado-libre.listing.synced',
          },
        });
        return listing;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Mercado Libre listing mapping is already in use',
        );
      }
      throw error;
    }
  }

  async importOrder(
    organizationId: string,
    actorUserId: string,
    integrationId: string,
    dto: MercadoLibreImportOrderDto,
  ) {
    await this.integration(organizationId, integrationId);
    const externalOrderId = dto.externalOrderId.trim();
    const requestHash = importRequestHash(dto, externalOrderId);
    const replay = await this.findImportedOrder(
      organizationId,
      integrationId,
      externalOrderId,
    );
    if (replay) {
      assertOrderReplay(replay, requestHash);
      await this.ensureOrderImportArtifacts(
        organizationId,
        actorUserId,
        integrationId,
        externalOrderId,
        replay.id,
      );
      return { idempotent: true, order: safeImportedOrder(replay) };
    }

    const preparedItems = [];
    for (const item of dto.items) {
      const listing = await this.prisma.mercadoLibreListing.findUnique({
        where: {
          integrationId_externalItemId_externalVariationId: {
            externalItemId: item.externalItemId.trim(),
            externalVariationId: item.externalVariationId?.trim() ?? '',
            integrationId,
          },
        },
      });
      if (!listing || listing.organizationId !== organizationId) {
        throw new BadRequestException('Mercado Libre order item is not mapped');
      }
      preparedItems.push({
        discountAmount: item.discountAmount,
        quantity: item.quantity,
        variantId: listing.variantId,
      });
    }

    let idempotent = false;
    let order;
    try {
      order = await this.orders.create(
        organizationId,
        actorUserId,
        {
          customerAddressId: dto.customerAddressId,
          customerId: dto.customerId,
          discountAmount: dto.discountAmount,
          items: preparedItems,
          notes: dto.notes,
          shippingAmount: dto.shippingAmount,
          warehouseId: dto.warehouseId,
        },
        { externalOrderId, integrationId, requestHash },
      );
    } catch (error) {
      const concurrent = await this.findImportedOrder(
        organizationId,
        integrationId,
        externalOrderId,
      );
      if (!concurrent) throw error;
      assertOrderReplay(concurrent, requestHash);
      order = concurrent;
      idempotent = true;
    }
    await this.ensureOrderImportArtifacts(
      organizationId,
      actorUserId,
      integrationId,
      externalOrderId,
      order.id,
    );
    return { idempotent, order: safeImportedOrder(order) };
  }

  async receiveWebhook(
    integrationId: string,
    sourceIp: string | undefined,
    dto: MercadoLibreWebhookDto,
  ) {
    const reference = await this.prisma.integration.findUnique({
      where: { id: integrationId },
      select: {
        active: true,
        config: true,
        organizationId: true,
        provider: true,
      },
    });
    if (!reference || !reference.active || reference.provider !== provider) {
      throw new NotFoundException('Integration not found');
    }
    assertAllowedWebhookSource(reference.config, sourceIp);
    assertWebhookIdentity(reference.config, dto);
    const externalEventId = dto._id.trim();
    const resource = dto.resource.trim();
    const topic = dto.topic.trim();
    if (!externalEventId || !resource || !topic) {
      throw new BadRequestException('Webhook fields must not be blank');
    }
    const payload = { ...dto, _id: externalEventId, resource, topic };
    const payloadHash = createRequestFingerprint(payload);
    const existing = await this.prisma.webhookReceipt.findUnique({
      where: {
        integrationId_externalEventId: { externalEventId, integrationId },
      },
    });
    if (existing) return webhookReplay(existing, payloadHash);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const receipt = await tx.webhookReceipt.create({
          data: {
            eventType: topic,
            externalEventId,
            integrationId,
            organizationId: reference.organizationId,
            payload,
            payloadHash,
          },
        });
        await tx.domainEvent.create({
          data: {
            aggregateId: receipt.id,
            aggregateType: 'webhook',
            integrationId,
            organizationId: reference.organizationId,
            payload: {
              receiptId: receipt.id,
              resource,
              topic,
            },
            type: 'mercado-libre.webhook.received',
          },
        });
        return { idempotent: false, receipt };
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrent = await this.prisma.webhookReceipt.findUnique({
          where: {
            integrationId_externalEventId: { externalEventId, integrationId },
          },
        });
        if (concurrent) return webhookReplay(concurrent, payloadHash);
      }
      throw error;
    }
  }

  private async integration(organizationId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { active: true, id: integrationId, organizationId, provider },
      select: { id: true },
    });
    if (!integration) {
      throw new BadRequestException(
        'Mercado Libre integration is invalid or inactive',
      );
    }
  }

  private findImportedOrder(
    organizationId: string,
    integrationId: string,
    externalOrderId: string,
  ) {
    return this.prisma.order.findFirst({
      where: {
        externalOrderId,
        organizationId,
        sourceIntegrationId: integrationId,
      },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async ensureOrderImportArtifacts(
    organizationId: string,
    actorUserId: string,
    integrationId: string,
    externalOrderId: string,
    orderId: string,
  ) {
    const existing = await this.prisma.externalReference.findUnique({
      where: {
        integrationId_entityType_externalId: {
          entityType: ExternalEntityType.ORDER,
          externalId: externalOrderId,
          integrationId,
        },
      },
    });
    if (existing) {
      if (existing.entityId !== orderId) {
        throw new ConflictException(
          'Mercado Libre order reference points to another order',
        );
      }
      return;
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.externalReference.create({
          data: {
            createdByUserId: actorUserId,
            entityId: orderId,
            entityType: ExternalEntityType.ORDER,
            externalId: externalOrderId,
            integrationId,
            organizationId,
          },
        });
        await tx.domainEvent.create({
          data: {
            aggregateId: orderId,
            aggregateType: 'order',
            integrationId,
            organizationId,
            payload: { externalOrderId, orderId },
            type: 'mercado-libre.order.imported',
          },
        });
      });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const concurrent = await this.prisma.externalReference.findUnique({
        where: {
          integrationId_entityType_externalId: {
            entityType: ExternalEntityType.ORDER,
            externalId: externalOrderId,
            integrationId,
          },
        },
      });
      if (!concurrent || concurrent.entityId !== orderId) throw error;
    }
  }
}

function webhookReplay<T extends { payloadHash: string }>(
  receipt: T,
  hash: string,
) {
  if (receipt.payloadHash !== hash) {
    throw new ConflictException(
      'Webhook event ID was reused with a different payload',
    );
  }
  return { idempotent: true, receipt };
}

function json(value: Record<string, unknown> | undefined) {
  return value === undefined ? undefined : (value as Prisma.InputJsonObject);
}

function importRequestHash(
  dto: MercadoLibreImportOrderDto,
  externalOrderId: string,
) {
  const items = dto.items
    .map((item) => ({
      discountAmount: item.discountAmount ?? 0,
      externalItemId: item.externalItemId.trim(),
      externalVariationId: item.externalVariationId?.trim() ?? '',
      quantity: item.quantity,
    }))
    .sort((left, right) =>
      `${left.externalItemId}\u0000${left.externalVariationId}`.localeCompare(
        `${right.externalItemId}\u0000${right.externalVariationId}`,
      ),
    );
  return createRequestFingerprint({
    customerAddressId: dto.customerAddressId,
    customerId: dto.customerId,
    discountAmount: dto.discountAmount ?? 0,
    externalOrderId,
    items,
    notes: dto.notes?.trim() || null,
    shippingAmount: dto.shippingAmount ?? 0,
    warehouseId: dto.warehouseId,
  });
}

function assertOrderReplay(
  order: { sourceRequestHash: string | null },
  requestHash: string,
) {
  if (order.sourceRequestHash !== requestHash) {
    throw new ConflictException(
      'Mercado Libre order ID was reused with a different payload',
    );
  }
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function assertAllowedWebhookSource(
  config: Prisma.JsonValue | null,
  sourceIp: string | undefined,
) {
  const allowed = webhookAllowedIps(config);
  const normalizedSource = normalizeIp(sourceIp);
  if (!normalizedSource || !allowed.includes(normalizedSource)) {
    throw new UnauthorizedException('Webhook source is not allowed');
  }
}

function assertWebhookIdentity(
  config: Prisma.JsonValue | null,
  dto: MercadoLibreWebhookDto,
) {
  const object = jsonObject(config);
  if (
    object?.applicationId !== dto.application_id ||
    object.sellerId !== dto.user_id
  ) {
    throw new UnauthorizedException('Webhook identity is not allowed');
  }
}

function webhookAllowedIps(config: Prisma.JsonValue | null) {
  const value = jsonObject(config)?.webhookAllowedIps;
  if (!Array.isArray(value)) return [];
  return value
    .filter((ip): ip is string => typeof ip === 'string')
    .map(normalizeIp)
    .filter((ip): ip is string => Boolean(ip));
}

function jsonObject(config: Prisma.JsonValue | null) {
  return config && !Array.isArray(config) && typeof config === 'object'
    ? config
    : undefined;
}

function normalizeIp(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

function safeImportedOrder<T extends object>(order: T) {
  const safe = { ...order } as Record<string, unknown>;
  delete safe.sourceRequestHash;
  return safe as Omit<T, 'sourceRequestHash'>;
}
