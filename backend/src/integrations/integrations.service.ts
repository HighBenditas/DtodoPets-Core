import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createRequestFingerprint } from '../common/idempotency/request-fingerprint';
import { createPage, getPagination } from '../common/pagination/pagination';
import { ExternalEntityType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialsEncryptionService } from './credentials-encryption.service';
import {
  CreateExternalReferenceDto,
  CreateIntegrationDto,
  CreateSalesChannelDto,
  IntegrationQueryDto,
  ReceiveWebhookDto,
  UpdateIntegrationDto,
  UpdateSalesChannelDto,
} from './dto/integration.dto';

const integrationInclude = {
  externalReferences: { orderBy: { createdAt: 'desc' }, take: 100 },
  salesChannel: {
    select: { active: true, id: true, key: true, name: true, type: true },
  },
  webhookReceipts: { orderBy: { receivedAt: 'desc' }, take: 20 },
} satisfies Prisma.IntegrationInclude;

type IntegrationWithRelations = Prisma.IntegrationGetPayload<{
  include: typeof integrationInclude;
}>;

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialsEncryptionService,
  ) {}

  async findChannels(organizationId: string, query: IntegrationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.SalesChannelWhereInput = {
      active: query.active,
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { key: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesChannel.findMany({
        where,
        ...getPagination(query),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        include: { _count: { select: { integrations: true } } },
      }),
      this.prisma.salesChannel.count({ where }),
    ]);
    return createPage(data, total, query);
  }

  async createChannel(
    organizationId: string,
    actorUserId: string,
    dto: CreateSalesChannelDto,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const channel = await tx.salesChannel.create({
          data: {
            createdByUserId: actorUserId,
            key: dto.key,
            metadata: json(dto.metadata),
            name: required(dto.name),
            organizationId,
            type: dto.type,
          },
        });
        await event(
          tx,
          organizationId,
          null,
          'sales-channel',
          channel.id,
          'sales-channel.created',
          { id: channel.id, key: channel.key, type: channel.type },
        );
        return channel;
      });
    } catch (error) {
      unique(error, 'Sales channel key is already in use');
      throw error;
    }
  }

  async updateChannel(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateSalesChannelDto,
  ) {
    await this.channel(organizationId, id);
    if (
      dto.name === undefined &&
      dto.active === undefined &&
      dto.metadata === undefined
    )
      throw new BadRequestException('At least one field must be provided');
    return this.prisma.$transaction(async (tx) => {
      const channel = await tx.salesChannel.update({
        where: { id },
        data: {
          active: dto.active,
          metadata: dto.metadata === undefined ? undefined : json(dto.metadata),
          name: dto.name === undefined ? undefined : required(dto.name),
        },
      });
      await event(
        tx,
        organizationId,
        null,
        'sales-channel',
        id,
        'sales-channel.updated',
        { actorUserId, active: channel.active, id },
      );
      return channel;
    });
  }

  async findIntegrations(organizationId: string, query: IntegrationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.IntegrationWhereInput = {
      active: query.active,
      organizationId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { key: { contains: search, mode: 'insensitive' } },
              { provider: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.integration.findMany({
        where,
        include: integrationInclude,
        ...getPagination(query),
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.integration.count({ where }),
    ]);
    return createPage(rows.map(safeIntegration), total, query);
  }

  async findIntegration(organizationId: string, id: string) {
    return safeIntegration(await this.integration(organizationId, id));
  }

  async createIntegration(
    organizationId: string,
    actorUserId: string,
    dto: CreateIntegrationDto,
  ) {
    if (dto.salesChannelId)
      await this.channel(organizationId, dto.salesChannelId);
    const provider = required(dto.provider).toLowerCase();
    const credentialsCiphertext = dto.credentials
      ? this.encryption.encrypt(
          dto.credentials,
          credentialContext(organizationId, dto.key),
        )
      : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const integration = await tx.integration.create({
          data: {
            config: json(dto.config),
            createdByUserId: actorUserId,
            credentialsCiphertext,
            key: dto.key,
            name: required(dto.name),
            organizationId,
            provider,
            salesChannelId: dto.salesChannelId,
          },
          include: integrationInclude,
        });
        await event(
          tx,
          organizationId,
          integration.id,
          'integration',
          integration.id,
          'integration.created',
          { id: integration.id, key: integration.key, provider },
        );
        return safeIntegration(integration);
      });
    } catch (error) {
      unique(error, 'Integration key is already in use');
      throw error;
    }
  }

  async updateIntegration(
    organizationId: string,
    actorUserId: string,
    id: string,
    dto: UpdateIntegrationDto,
  ) {
    const current = await this.integration(organizationId, id);
    if (dto.salesChannelId)
      await this.channel(organizationId, dto.salesChannelId);
    if (
      dto.name === undefined &&
      dto.active === undefined &&
      dto.salesChannelId === undefined &&
      dto.config === undefined &&
      dto.credentials === undefined
    )
      throw new BadRequestException('At least one field must be provided');
    const credentialsCiphertext = dto.credentials
      ? this.encryption.encrypt(
          dto.credentials,
          credentialContext(organizationId, current.key),
        )
      : undefined;
    return this.prisma.$transaction(async (tx) => {
      const integration = await tx.integration.update({
        where: { id },
        data: {
          active: dto.active,
          config: dto.config === undefined ? undefined : json(dto.config),
          credentialsCiphertext,
          name: dto.name === undefined ? undefined : required(dto.name),
          salesChannelId: dto.salesChannelId,
        },
        include: integrationInclude,
      });
      await event(
        tx,
        organizationId,
        id,
        'integration',
        id,
        'integration.updated',
        { actorUserId, active: integration.active, id },
      );
      return safeIntegration(integration);
    });
  }

  async createExternalReference(
    organizationId: string,
    actorUserId: string,
    integrationId: string,
    dto: CreateExternalReferenceDto,
  ) {
    await this.integration(organizationId, integrationId);
    await this.assertEntity(organizationId, dto.entityType, dto.entityId);
    const existing = await this.prisma.externalReference.findUnique({
      where: {
        integrationId_entityType_entityId: {
          entityId: dto.entityId,
          entityType: dto.entityType,
          integrationId,
        },
      },
    });
    if (existing) {
      if (existing.externalId !== dto.externalId.trim())
        throw new ConflictException(
          'Entity already maps to a different external ID',
        );
      return { idempotent: true, reference: existing };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const reference = await tx.externalReference.create({
          data: {
            createdByUserId: actorUserId,
            entityId: dto.entityId.trim(),
            entityType: dto.entityType,
            externalId: dto.externalId.trim(),
            integrationId,
            metadata: json(dto.metadata),
            organizationId,
          },
        });
        await event(
          tx,
          organizationId,
          integrationId,
          dto.entityType.toLowerCase(),
          dto.entityId,
          'external-reference.created',
          {
            externalId: reference.externalId,
            integrationId,
            referenceId: reference.id,
          },
        );
        return { idempotent: false, reference };
      });
    } catch (error) {
      unique(error, 'External reference is already in use');
      throw error;
    }
  }

  async receiveWebhook(
    organizationId: string,
    integrationId: string,
    dto: ReceiveWebhookDto,
  ) {
    await this.integration(organizationId, integrationId);
    const externalEventId = required(dto.externalEventId);
    const eventType = required(dto.eventType);
    const payloadHash = createRequestFingerprint({
      eventType,
      payload: dto.payload,
    });
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
            eventType,
            externalEventId,
            integrationId,
            organizationId,
            payload: json(dto.payload)!,
            payloadHash,
          },
        });
        await event(
          tx,
          organizationId,
          integrationId,
          'webhook',
          receipt.id,
          'integration.webhook.received',
          { eventType, receiptId: receipt.id },
        );
        return { idempotent: false, receipt };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.webhookReceipt.findUnique({
          where: {
            integrationId_externalEventId: { externalEventId, integrationId },
          },
        });
        if (replay) return webhookReplay(replay, payloadHash);
      }
      throw error;
    }
  }

  findEvents(organizationId: string) {
    return this.prisma.domainEvent.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  private channel(organizationId: string, id: string) {
    return this.prisma.salesChannel
      .findFirstOrThrow({ where: { id, organizationId } })
      .catch(() => {
        throw new NotFoundException('Sales channel not found');
      });
  }

  private integration(organizationId: string, id: string) {
    return this.prisma.integration
      .findFirst({ where: { id, organizationId }, include: integrationInclude })
      .then((value) => {
        if (!value) throw new NotFoundException('Integration not found');
        return value;
      });
  }

  private async assertEntity(
    organizationId: string,
    type: ExternalEntityType,
    id: string,
  ) {
    const where = { id, organizationId };
    let found: { id: string } | null = null;
    if (type === ExternalEntityType.ORDER)
      found = await this.prisma.order.findFirst({
        where,
        select: { id: true },
      });
    if (type === ExternalEntityType.PRODUCT)
      found = await this.prisma.product.findFirst({
        where,
        select: { id: true },
      });
    if (type === ExternalEntityType.VARIANT)
      found = await this.prisma.productVariant.findFirst({
        where,
        select: { id: true },
      });
    if (type === ExternalEntityType.CUSTOMER)
      found = await this.prisma.customer.findFirst({
        where,
        select: { id: true },
      });
    if (type === ExternalEntityType.SHIPMENT)
      found = await this.prisma.shipment.findFirst({
        where,
        select: { id: true },
      });
    if (!found) throw new NotFoundException('Referenced entity not found');
  }
}

function safeIntegration(value: IntegrationWithRelations) {
  const { credentialsCiphertext, ...safe } = value;
  return { ...safe, hasCredentials: credentialsCiphertext !== null };
}

function webhookReplay<T extends { payloadHash: string }>(
  receipt: T,
  hash: string,
) {
  if (receipt.payloadHash !== hash)
    throw new ConflictException(
      'Webhook event ID was reused with a different payload',
    );
  return { idempotent: true, receipt };
}

function event(
  tx: Prisma.TransactionClient,
  organizationId: string,
  integrationId: string | null,
  aggregateType: string,
  aggregateId: string,
  type: string,
  payload: Record<string, unknown>,
) {
  return tx.domainEvent.create({
    data: {
      aggregateId,
      aggregateType,
      integrationId,
      organizationId,
      payload: payload as Prisma.InputJsonObject,
      type,
    },
  });
}

function json(value: Record<string, unknown> | undefined) {
  return value === undefined ? undefined : (value as Prisma.InputJsonObject);
}

function credentialContext(organizationId: string, key: string) {
  return `${organizationId}:${key}`;
}
function required(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException('Required text is blank');
  return normalized;
}
function unique(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
    throw new ConflictException(message);
}
