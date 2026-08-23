CREATE TYPE "MercadoLibreListingStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

ALTER TABLE "Order"
ADD COLUMN "sourceIntegrationId" TEXT,
ADD COLUMN "externalOrderId" TEXT;

CREATE TABLE "MercadoLibreListing" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "integrationId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "externalItemId" TEXT NOT NULL,
  "externalVariationId" TEXT NOT NULL DEFAULT '',
  "status" "MercadoLibreListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'CLP',
  "listingPriceAmount" DECIMAL(14,0),
  "feeAmount" DECIMAL(14,0),
  "availableQuantity" INTEGER,
  "metadata" JSONB,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MercadoLibreListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_sourceIntegrationId_externalOrderId_key" ON "Order"("sourceIntegrationId", "externalOrderId");
CREATE UNIQUE INDEX "MercadoLibreListing_integrationId_externalItemId_externalVariationId_key" ON "MercadoLibreListing"("integrationId", "externalItemId", "externalVariationId");
CREATE UNIQUE INDEX "MercadoLibreListing_integrationId_variantId_key" ON "MercadoLibreListing"("integrationId", "variantId");
CREATE UNIQUE INDEX "MercadoLibreListing_id_organizationId_key" ON "MercadoLibreListing"("id", "organizationId");
CREATE INDEX "MercadoLibreListing_organizationId_status_updatedAt_idx" ON "MercadoLibreListing"("organizationId", "status", "updatedAt");
CREATE INDEX "MercadoLibreListing_variantId_idx" ON "MercadoLibreListing"("variantId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_sourceIntegrationId_organizationId_fkey" FOREIGN KEY ("sourceIntegrationId", "organizationId") REFERENCES "Integration"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MercadoLibreListing" ADD CONSTRAINT "MercadoLibreListing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MercadoLibreListing" ADD CONSTRAINT "MercadoLibreListing_integrationId_organizationId_fkey" FOREIGN KEY ("integrationId", "organizationId") REFERENCES "Integration"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MercadoLibreListing" ADD CONSTRAINT "MercadoLibreListing_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "ProductVariant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_source_pair" CHECK (("sourceIntegrationId" IS NULL AND "externalOrderId" IS NULL) OR ("sourceIntegrationId" IS NOT NULL AND length(btrim("externalOrderId")) > 0));
ALTER TABLE "MercadoLibreListing"
ADD CONSTRAINT "MercadoLibreListing_external_ids_not_blank" CHECK (length(btrim("externalItemId")) > 0 AND ("externalVariationId" = '' OR length(btrim("externalVariationId")) > 0)),
ADD CONSTRAINT "MercadoLibreListing_currency_clp" CHECK ("currency" = 'CLP'),
ADD CONSTRAINT "MercadoLibreListing_amounts_nonnegative" CHECK (("listingPriceAmount" IS NULL OR "listingPriceAmount" >= 0) AND ("feeAmount" IS NULL OR "feeAmount" >= 0)),
ADD CONSTRAINT "MercadoLibreListing_quantity_nonnegative" CHECK ("availableQuantity" IS NULL OR "availableQuantity" >= 0);
