-- Walk-in point-of-sale orders do not require a persisted customer or address.
ALTER TABLE "Order"
  ALTER COLUMN "customerId" DROP NOT NULL,
  ALTER COLUMN "customerAddressId" DROP NOT NULL,
  ADD COLUMN "salesChannelId" TEXT,
  ADD COLUMN "checkoutIdempotencyKey" TEXT,
  ADD COLUMN "checkoutRequestHash" TEXT;

-- A manual branch channel identifies POS sales without overloading integrations.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_salesChannelId_organizationId_fkey"
  FOREIGN KEY ("salesChannelId", "organizationId")
  REFERENCES "SalesChannel"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Order_organizationId_checkoutIdempotencyKey_key"
  ON "Order"("organizationId", "checkoutIdempotencyKey");

CREATE INDEX "Order_salesChannelId_createdAt_idx"
  ON "Order"("salesChannelId", "createdAt");

-- One local variant may be sold through more than one Mercado Libre listing.
DROP INDEX "MercadoLibreListing_integrationId_variantId_key";
