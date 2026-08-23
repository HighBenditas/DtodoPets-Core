-- CreateEnum
CREATE TYPE "SalesChannelType" AS ENUM ('OWN_STOREFRONT', 'MARKETPLACE', 'SOCIAL_COMMERCE', 'MESSAGING', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalEntityType" AS ENUM ('ORDER', 'PRODUCT', 'VARIANT', 'CUSTOMER', 'SHIPMENT');

-- CreateEnum
CREATE TYPE "WebhookReceiptStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "DomainEventStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "SalesChannel" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SalesChannelType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesChannelId" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "credentialsCiphertext" TEXT,
    "credentialKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "entityType" "ExternalEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "WebhookReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "DomainEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesChannel_organizationId_active_name_idx" ON "SalesChannel"("organizationId", "active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_organizationId_key_key" ON "SalesChannel"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "SalesChannel_id_organizationId_key" ON "SalesChannel"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Integration_organizationId_active_provider_idx" ON "Integration"("organizationId", "active", "provider");

-- CreateIndex
CREATE INDEX "Integration_salesChannelId_idx" ON "Integration"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_organizationId_key_key" ON "Integration"("organizationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_id_organizationId_key" ON "Integration"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ExternalReference_organizationId_entityType_entityId_idx" ON "ExternalReference"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExternalReference_organizationId_externalId_idx" ON "ExternalReference"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_integrationId_entityType_entityId_key" ON "ExternalReference"("integrationId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_integrationId_entityType_externalId_key" ON "ExternalReference"("integrationId", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_id_organizationId_key" ON "ExternalReference"("id", "organizationId");

-- CreateIndex
CREATE INDEX "WebhookReceipt_organizationId_status_receivedAt_idx" ON "WebhookReceipt"("organizationId", "status", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookReceipt_integrationId_eventType_receivedAt_idx" ON "WebhookReceipt"("integrationId", "eventType", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookReceipt_integrationId_externalEventId_key" ON "WebhookReceipt"("integrationId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookReceipt_id_organizationId_key" ON "WebhookReceipt"("id", "organizationId");

-- CreateIndex
CREATE INDEX "DomainEvent_organizationId_status_availableAt_idx" ON "DomainEvent"("organizationId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateType_aggregateId_createdAt_idx" ON "DomainEvent"("aggregateType", "aggregateId", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_integrationId_createdAt_idx" ON "DomainEvent"("integrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_id_organizationId_key" ON "DomainEvent"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "SalesChannel" ADD CONSTRAINT "SalesChannel_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesChannel" ADD CONSTRAINT "SalesChannel_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_salesChannelId_organizationId_fkey" FOREIGN KEY ("salesChannelId", "organizationId") REFERENCES "SalesChannel"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_integrationId_organizationId_fkey" FOREIGN KEY ("integrationId", "organizationId") REFERENCES "Integration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalReference" ADD CONSTRAINT "ExternalReference_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookReceipt" ADD CONSTRAINT "WebhookReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookReceipt" ADD CONSTRAINT "WebhookReceipt_integrationId_organizationId_fkey" FOREIGN KEY ("integrationId", "organizationId") REFERENCES "Integration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_integrationId_organizationId_fkey" FOREIGN KEY ("integrationId", "organizationId") REFERENCES "Integration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain constraints for stable keys, encrypted secrets and idempotent events.
ALTER TABLE "SalesChannel"
ADD CONSTRAINT "SalesChannel_key_format" CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
ADD CONSTRAINT "SalesChannel_name_not_blank" CHECK (length(btrim("name")) > 0);

ALTER TABLE "Integration"
ADD CONSTRAINT "Integration_key_format" CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
ADD CONSTRAINT "Integration_name_provider_not_blank" CHECK (length(btrim("name")) > 0 AND length(btrim("provider")) > 0),
ADD CONSTRAINT "Integration_credential_version_positive" CHECK ("credentialKeyVersion" > 0),
ADD CONSTRAINT "Integration_credentials_encrypted_format" CHECK ("credentialsCiphertext" IS NULL OR "credentialsCiphertext" ~ '^v[0-9]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$');

ALTER TABLE "ExternalReference"
ADD CONSTRAINT "ExternalReference_ids_not_blank" CHECK (length(btrim("entityId")) > 0 AND length(btrim("externalId")) > 0);

ALTER TABLE "WebhookReceipt"
ADD CONSTRAINT "WebhookReceipt_identity_not_blank" CHECK (length(btrim("externalEventId")) > 0 AND length(btrim("eventType")) > 0),
ADD CONSTRAINT "WebhookReceipt_hash_format" CHECK ("payloadHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "WebhookReceipt_attempts_nonnegative" CHECK ("attempts" >= 0),
ADD CONSTRAINT "WebhookReceipt_status_timestamps" CHECK (
  ("status" IN ('RECEIVED', 'FAILED') AND "processedAt" IS NULL) OR
  ("status" = 'PROCESSED' AND "processedAt" IS NOT NULL)
);

ALTER TABLE "DomainEvent"
ADD CONSTRAINT "DomainEvent_identity_not_blank" CHECK (length(btrim("aggregateType")) > 0 AND length(btrim("aggregateId")) > 0 AND length(btrim("type")) > 0),
ADD CONSTRAINT "DomainEvent_attempts_nonnegative" CHECK ("attempts" >= 0),
ADD CONSTRAINT "DomainEvent_status_timestamps" CHECK (
  ("status" IN ('PENDING', 'FAILED') AND "publishedAt" IS NULL) OR
  ("status" = 'PUBLISHED' AND "publishedAt" IS NOT NULL)
);
