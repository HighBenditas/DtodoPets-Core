CREATE TYPE "PromotionType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "PromotionScope" AS ENUM ('ALL_CATALOG', 'VARIANTS');
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKED_OUT', 'ABANDONED', 'EXPIRED');

CREATE TABLE "Promotion" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "salesChannelId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "code" TEXT,
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "type" "PromotionType" NOT NULL,
  "scope" "PromotionScope" NOT NULL DEFAULT 'ALL_CATALOG',
  "value" INTEGER NOT NULL,
  "minimumSubtotalAmount" DECIMAL(14,0) NOT NULL DEFAULT 0,
  "maximumDiscountAmount" DECIMAL(14,0),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionVariant" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "salesChannelId" TEXT NOT NULL,
  "promotionId" TEXT,
  "customerId" TEXT,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'CLP',
  "accessTokenHash" TEXT NOT NULL,
  "checkoutRequestHash" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "checkedOutAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionRedemption" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "promotionId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "codeSnapshot" TEXT,
  "typeSnapshot" "PromotionType" NOT NULL,
  "valueSnapshot" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CLP',
  "discountAmount" DECIMAL(14,0) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "storefrontCartId" TEXT;

CREATE UNIQUE INDEX "Promotion_organizationId_code_key" ON "Promotion"("organizationId", "code");
CREATE UNIQUE INDEX "Promotion_id_organizationId_key" ON "Promotion"("id", "organizationId");
CREATE INDEX "Promotion_organizationId_active_startsAt_endsAt_idx" ON "Promotion"("organizationId", "active", "startsAt", "endsAt");
CREATE INDEX "Promotion_salesChannelId_active_idx" ON "Promotion"("salesChannelId", "active");

CREATE UNIQUE INDEX "PromotionVariant_promotionId_variantId_key" ON "PromotionVariant"("promotionId", "variantId");
CREATE UNIQUE INDEX "PromotionVariant_id_organizationId_key" ON "PromotionVariant"("id", "organizationId");
CREATE INDEX "PromotionVariant_organizationId_variantId_idx" ON "PromotionVariant"("organizationId", "variantId");

CREATE UNIQUE INDEX "Cart_accessTokenHash_key" ON "Cart"("accessTokenHash");
CREATE UNIQUE INDEX "Cart_id_organizationId_key" ON "Cart"("id", "organizationId");
CREATE INDEX "Cart_organizationId_status_expiresAt_idx" ON "Cart"("organizationId", "status", "expiresAt");
CREATE INDEX "Cart_salesChannelId_status_updatedAt_idx" ON "Cart"("salesChannelId", "status", "updatedAt");
CREATE INDEX "Cart_promotionId_idx" ON "Cart"("promotionId");
CREATE INDEX "Cart_customerId_idx" ON "Cart"("customerId");

CREATE UNIQUE INDEX "CartItem_cartId_variantId_key" ON "CartItem"("cartId", "variantId");
CREATE UNIQUE INDEX "CartItem_id_organizationId_key" ON "CartItem"("id", "organizationId");
CREATE INDEX "CartItem_organizationId_updatedAt_idx" ON "CartItem"("organizationId", "updatedAt");
CREATE INDEX "CartItem_variantId_idx" ON "CartItem"("variantId");

CREATE UNIQUE INDEX "PromotionRedemption_promotionId_orderId_key" ON "PromotionRedemption"("promotionId", "orderId");
CREATE UNIQUE INDEX "PromotionRedemption_id_organizationId_key" ON "PromotionRedemption"("id", "organizationId");
CREATE INDEX "PromotionRedemption_organizationId_createdAt_idx" ON "PromotionRedemption"("organizationId", "createdAt");
CREATE INDEX "PromotionRedemption_orderId_idx" ON "PromotionRedemption"("orderId");
CREATE INDEX "PromotionRedemption_customerId_createdAt_idx" ON "PromotionRedemption"("customerId", "createdAt");

CREATE UNIQUE INDEX "Order_storefrontCartId_organizationId_key" ON "Order"("storefrontCartId", "organizationId");

ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_salesChannelId_organizationId_fkey" FOREIGN KEY ("salesChannelId", "organizationId") REFERENCES "SalesChannel"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionVariant" ADD CONSTRAINT "PromotionVariant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionVariant" ADD CONSTRAINT "PromotionVariant_promotionId_organizationId_fkey" FOREIGN KEY ("promotionId", "organizationId") REFERENCES "Promotion"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionVariant" ADD CONSTRAINT "PromotionVariant_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "ProductVariant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cart" ADD CONSTRAINT "Cart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_salesChannelId_organizationId_fkey" FOREIGN KEY ("salesChannelId", "organizationId") REFERENCES "SalesChannel"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_promotionId_organizationId_fkey" FOREIGN KEY ("promotionId", "organizationId") REFERENCES "Promotion"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_organizationId_fkey" FOREIGN KEY ("cartId", "organizationId") REFERENCES "Cart"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "ProductVariant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionId_organizationId_fkey" FOREIGN KEY ("promotionId", "organizationId") REFERENCES "Promotion"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_storefrontCartId_organizationId_fkey" FOREIGN KEY ("storefrontCartId", "organizationId") REFERENCES "Cart"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Promotion"
ADD CONSTRAINT "Promotion_text_and_mode" CHECK (
  length(btrim("name")) > 0
  AND (
    ("automatic" = true AND "code" IS NULL)
    OR
    ("automatic" = false AND "code" IS NOT NULL AND length(btrim("code")) > 0)
  )
),
ADD CONSTRAINT "Promotion_value" CHECK (
  ("type" = 'PERCENTAGE' AND "value" BETWEEN 1 AND 100)
  OR ("type" = 'FIXED_AMOUNT' AND "value" > 0)
),
ADD CONSTRAINT "Promotion_amounts" CHECK (
  "minimumSubtotalAmount" >= 0
  AND ("maximumDiscountAmount" IS NULL OR "maximumDiscountAmount" > 0)
),
ADD CONSTRAINT "Promotion_dates_priority" CHECK (
  "priority" >= 0 AND ("endsAt" IS NULL OR "endsAt" > "startsAt")
);

ALTER TABLE "Cart"
ADD CONSTRAINT "Cart_token_currency_version" CHECK (
  "currency" = 'CLP'
  AND "accessTokenHash" ~ '^[0-9a-f]{64}$'
  AND "version" >= 0
  AND "expiresAt" > "createdAt"
),
ADD CONSTRAINT "Cart_state" CHECK (
  (
    "status" = 'ACTIVE'
    AND "customerId" IS NULL
    AND "checkoutRequestHash" IS NULL
    AND "checkedOutAt" IS NULL
  )
  OR
  (
    "status" = 'CHECKED_OUT'
    AND "customerId" IS NOT NULL
    AND "checkoutRequestHash" ~ '^[0-9a-f]{64}$'
    AND "checkedOutAt" IS NOT NULL
  )
  OR
  (
    "status" IN ('ABANDONED', 'EXPIRED')
    AND "customerId" IS NULL
    AND "checkoutRequestHash" IS NULL
    AND "checkedOutAt" IS NULL
  )
);

ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "PromotionRedemption"
ADD CONSTRAINT "PromotionRedemption_snapshot" CHECK (
  length(btrim("nameSnapshot")) > 0
  AND "valueSnapshot" > 0
  AND "currency" = 'CLP'
  AND "discountAmount" > 0
);

ALTER TABLE "Order" DROP CONSTRAINT "Order_source_pair";
ALTER TABLE "Order" ADD CONSTRAINT "Order_source_pair" CHECK (
  (
    "sourceIntegrationId" IS NULL
    AND "externalOrderId" IS NULL
    AND "storefrontCartId" IS NULL
    AND "sourceRequestHash" IS NULL
  )
  OR
  (
    "sourceIntegrationId" IS NOT NULL
    AND "externalOrderId" IS NOT NULL
    AND length(btrim("externalOrderId")) > 0
    AND "storefrontCartId" IS NULL
    AND "sourceRequestHash" IS NOT NULL
    AND "sourceRequestHash" ~ '^[0-9a-f]{64}$'
  )
  OR
  (
    "sourceIntegrationId" IS NULL
    AND "externalOrderId" IS NULL
    AND "storefrontCartId" IS NOT NULL
    AND "sourceRequestHash" IS NOT NULL
    AND "sourceRequestHash" ~ '^[0-9a-f]{64}$'
  )
);
