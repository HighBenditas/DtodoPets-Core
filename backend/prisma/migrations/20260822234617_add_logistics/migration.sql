-- CreateEnum
CREATE TYPE "ShipmentType" AS ENUM ('PICKUP', 'OWN_DELIVERY', 'MARKETPLACE', 'EXTERNAL_COURIER');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'READY', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ShipmentType" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "customerChargeAmount" DECIMAL(14,0) NOT NULL DEFAULT 0,
    "actualCostAmount" DECIMAL(14,0),
    "carrier" TEXT,
    "serviceName" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "readyAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentStatusHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "actualCostAmount" DECIMAL(14,0),
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Shipment_organizationId_status_createdAt_idx" ON "Shipment"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Shipment_orderId_createdAt_idx" ON "Shipment"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_organizationId_number_key" ON "Shipment"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_organizationId_idempotencyKey_key" ON "Shipment"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_organizationId_carrier_trackingNumber_key" ON "Shipment"("organizationId", "carrier", "trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_id_organizationId_key" ON "Shipment"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ShipmentItem_organizationId_createdAt_idx" ON "ShipmentItem"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentItem_orderItemId_createdAt_idx" ON "ShipmentItem"("orderItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentItem_shipmentId_orderItemId_key" ON "ShipmentItem"("shipmentId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentItem_id_organizationId_key" ON "ShipmentItem"("id", "organizationId");

-- CreateIndex
CREATE INDEX "ShipmentStatusHistory_organizationId_createdAt_idx" ON "ShipmentStatusHistory"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ShipmentStatusHistory_shipmentId_createdAt_idx" ON "ShipmentStatusHistory"("shipmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_organizationId_fkey" FOREIGN KEY ("shipmentId", "organizationId") REFERENCES "Shipment"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_orderItemId_organizationId_fkey" FOREIGN KEY ("orderItemId", "organizationId") REFERENCES "OrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_shipmentId_organizationId_fkey" FOREIGN KEY ("shipmentId", "organizationId") REFERENCES "Shipment"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentStatusHistory" ADD CONSTRAINT "ShipmentStatusHistory_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints for exact costs, valid tracking metadata and lifecycle.
ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_currency_clp" CHECK ("currency" = 'CLP'),
ADD CONSTRAINT "Shipment_amounts_nonnegative" CHECK ("customerChargeAmount" >= 0 AND ("actualCostAmount" IS NULL OR "actualCostAmount" >= 0)),
ADD CONSTRAINT "Shipment_number_not_blank" CHECK (length(btrim("number")) > 0),
ADD CONSTRAINT "Shipment_idempotency_not_blank" CHECK (length(btrim("idempotencyKey")) > 0),
ADD CONSTRAINT "Shipment_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "Shipment_text_fields_not_blank" CHECK (
  ("carrier" IS NULL OR length(btrim("carrier")) > 0) AND
  ("serviceName" IS NULL OR length(btrim("serviceName")) > 0) AND
  ("trackingNumber" IS NULL OR length(btrim("trackingNumber")) > 0) AND
  ("trackingUrl" IS NULL OR length(btrim("trackingUrl")) > 0)
),
ADD CONSTRAINT "Shipment_tracking_pair" CHECK ("trackingUrl" IS NULL OR "trackingNumber" IS NOT NULL),
ADD CONSTRAINT "Shipment_type_metadata" CHECK (
  ("type" = 'PICKUP' AND "carrier" IS NULL AND "trackingNumber" IS NULL AND "trackingUrl" IS NULL) OR
  ("type" = 'EXTERNAL_COURIER' AND "carrier" IS NOT NULL) OR
  "type" IN ('OWN_DELIVERY', 'MARKETPLACE')
),
ADD CONSTRAINT "Shipment_status_timestamps" CHECK (
  ("status" = 'PENDING' AND "readyAt" IS NULL AND "shippedAt" IS NULL AND "deliveredAt" IS NULL AND "cancelledAt" IS NULL) OR
  ("status" = 'READY' AND "readyAt" IS NOT NULL AND "shippedAt" IS NULL AND "deliveredAt" IS NULL AND "cancelledAt" IS NULL) OR
  ("status" = 'IN_TRANSIT' AND "readyAt" IS NOT NULL AND "shippedAt" IS NOT NULL AND "deliveredAt" IS NULL AND "cancelledAt" IS NULL) OR
  ("status" = 'DELIVERED' AND "readyAt" IS NOT NULL AND "deliveredAt" IS NOT NULL AND "cancelledAt" IS NULL AND "actualCostAmount" IS NOT NULL) OR
  ("status" = 'CANCELLED' AND "shippedAt" IS NULL AND "deliveredAt" IS NULL AND "cancelledAt" IS NOT NULL)
);

ALTER TABLE "ShipmentItem"
ADD CONSTRAINT "ShipmentItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "ShipmentStatusHistory"
ADD CONSTRAINT "ShipmentStatusHistory_reason_not_blank" CHECK (length(btrim("reason")) > 0),
ADD CONSTRAINT "ShipmentStatusHistory_actual_cost_nonnegative" CHECK ("actualCostAmount" IS NULL OR "actualCostAmount" >= 0),
ADD CONSTRAINT "ShipmentStatusHistory_tracking_pair" CHECK ("trackingUrl" IS NULL OR "trackingNumber" IS NOT NULL);
