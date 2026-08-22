-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- Extend reservations for stock consumption on order confirmation.
ALTER TABLE "InventoryReservation"
DROP CONSTRAINT "InventoryReservation_release_state",
ADD COLUMN "consumeReason" TEXT,
ADD COLUMN "consumedAt" TIMESTAMP(3),
ADD COLUMN "consumedByUserId" TEXT;

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_release_state" CHECK (
  ("status" = 'ACTIVE' AND "releasedByUserId" IS NULL AND "releaseReason" IS NULL AND "releasedAt" IS NULL AND "consumedByUserId" IS NULL AND "consumeReason" IS NULL AND "consumedAt" IS NULL) OR
  ("status" = 'RELEASED' AND "releasedByUserId" IS NOT NULL AND length(btrim("releaseReason")) > 0 AND "releasedAt" IS NOT NULL AND "consumedByUserId" IS NULL AND "consumeReason" IS NULL AND "consumedAt" IS NULL) OR
  ("status" = 'CONSUMED' AND "consumedByUserId" IS NOT NULL AND length(btrim("consumeReason")) > 0 AND "consumedAt" IS NOT NULL AND "releasedByUserId" IS NULL AND "releaseReason" IS NULL AND "releasedAt" IS NULL)
);

ALTER TABLE "InventoryMovement"
DROP CONSTRAINT "InventoryMovement_delta_matches_type",
ADD CONSTRAINT "InventoryMovement_delta_matches_type" CHECK (
  ("type" = 'ADJUSTMENT' AND "physicalDelta" <> 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_OUT' AND "physicalDelta" < 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_IN' AND "physicalDelta" > 0 AND "reservedDelta" = 0) OR
  ("type" = 'RESERVATION' AND "physicalDelta" = 0 AND "reservedDelta" > 0) OR
  ("type" = 'RELEASE' AND "physicalDelta" = 0 AND "reservedDelta" < 0) OR
  ("type" = 'COMMIT' AND "physicalDelta" < 0 AND "reservedDelta" = "physicalDelta")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerAddressId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "subtotalAmount" DECIMAL(14,0) NOT NULL,
    "discountAmount" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "shippingAmount" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,0) NOT NULL,
    "customerSnapshot" JSONB NOT NULL,
    "shippingSnapshot" JSONB NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "inventoryReservationId" TEXT,
    "skuSnapshot" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "unitPriceAmount" DECIMAL(14,0) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotalAmount" DECIMAL(14,0) NOT NULL,
    "discountAmount" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_organizationId_status_createdAt_idx" ON "Order"("organizationId", "status", "createdAt");
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");
CREATE INDEX "Order_warehouseId_createdAt_idx" ON "Order"("warehouseId", "createdAt");
CREATE UNIQUE INDEX "Order_organizationId_number_key" ON "Order"("organizationId", "number");
CREATE UNIQUE INDEX "Order_id_organizationId_key" ON "Order"("id", "organizationId");
CREATE INDEX "OrderItem_organizationId_createdAt_idx" ON "OrderItem"("organizationId", "createdAt");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");
CREATE UNIQUE INDEX "OrderItem_id_organizationId_key" ON "OrderItem"("id", "organizationId");
CREATE UNIQUE INDEX "OrderItem_orderId_variantId_key" ON "OrderItem"("orderId", "variantId");
CREATE UNIQUE INDEX "OrderItem_inventoryReservationId_organizationId_key" ON "OrderItem"("inventoryReservationId", "organizationId");
CREATE INDEX "OrderStatusHistory_organizationId_createdAt_idx" ON "OrderStatusHistory"("organizationId", "createdAt");
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_consumedByUserId_organizationId_fkey" FOREIGN KEY ("consumedByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerAddressId_organizationId_fkey" FOREIGN KEY ("customerAddressId", "organizationId") REFERENCES "CustomerAddress"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_warehouseId_organizationId_fkey" FOREIGN KEY ("warehouseId", "organizationId") REFERENCES "Warehouse"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "ProductVariant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_inventoryReservationId_organizationId_fkey" FOREIGN KEY ("inventoryReservationId", "organizationId") REFERENCES "InventoryReservation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints
ALTER TABLE "Order"
ADD CONSTRAINT "Order_currency_clp" CHECK ("currency" = 'CLP'),
ADD CONSTRAINT "Order_amounts_nonnegative" CHECK ("subtotalAmount" >= 0 AND "discountAmount" >= 0 AND "shippingAmount" >= 0 AND "totalAmount" >= 0),
ADD CONSTRAINT "Order_discount_valid" CHECK ("discountAmount" <= "subtotalAmount"),
ADD CONSTRAINT "Order_total_arithmetic" CHECK ("totalAmount" = "subtotalAmount" - "discountAmount" + "shippingAmount"),
ADD CONSTRAINT "Order_status_timestamps" CHECK (
  ("status" = 'PENDING' AND "confirmedAt" IS NULL AND "cancelledAt" IS NULL AND "completedAt" IS NULL) OR
  ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "cancelledAt" IS NULL AND "completedAt" IS NULL) OR
  ("status" = 'CANCELLED' AND "confirmedAt" IS NULL AND "cancelledAt" IS NOT NULL AND "completedAt" IS NULL) OR
  ("status" = 'COMPLETED' AND "confirmedAt" IS NOT NULL AND "cancelledAt" IS NULL AND "completedAt" IS NOT NULL)
);

ALTER TABLE "OrderItem"
ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0),
ADD CONSTRAINT "OrderItem_amounts_nonnegative" CHECK ("unitPriceAmount" >= 0 AND "subtotalAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0),
ADD CONSTRAINT "OrderItem_subtotal_arithmetic" CHECK ("subtotalAmount" = "unitPriceAmount" * "quantity"),
ADD CONSTRAINT "OrderItem_discount_valid" CHECK ("discountAmount" <= "subtotalAmount"),
ADD CONSTRAINT "OrderItem_total_arithmetic" CHECK ("totalAmount" = "subtotalAmount" - "discountAmount");

ALTER TABLE "OrderStatusHistory"
ADD CONSTRAINT "OrderStatusHistory_reason_not_blank" CHECK (length(btrim("reason")) > 0);
