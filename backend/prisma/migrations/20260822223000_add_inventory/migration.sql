-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'RESERVATION', 'RELEASE');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "physicalQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "physicalDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "physicalBefore" INTEGER NOT NULL,
    "physicalAfter" INTEGER NOT NULL,
    "reservedBefore" INTEGER NOT NULL,
    "reservedAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "balanceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "releasedByUserId" TEXT,
    "releaseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBalance_organizationId_updatedAt_idx" ON "InventoryBalance"("organizationId", "updatedAt");
CREATE INDEX "InventoryBalance_warehouseId_idx" ON "InventoryBalance"("warehouseId");
CREATE INDEX "InventoryBalance_variantId_idx" ON "InventoryBalance"("variantId");
CREATE UNIQUE INDEX "InventoryBalance_organizationId_warehouseId_variantId_key" ON "InventoryBalance"("organizationId", "warehouseId", "variantId");
CREATE UNIQUE INDEX "InventoryBalance_id_organizationId_key" ON "InventoryBalance"("id", "organizationId");
CREATE INDEX "InventoryMovement_organizationId_createdAt_idx" ON "InventoryMovement"("organizationId", "createdAt");
CREATE INDEX "InventoryMovement_balanceId_createdAt_idx" ON "InventoryMovement"("balanceId", "createdAt");
CREATE INDEX "InventoryMovement_organizationId_operationId_idx" ON "InventoryMovement"("organizationId", "operationId");
CREATE INDEX "InventoryMovement_organizationId_referenceType_referenceId_idx" ON "InventoryMovement"("organizationId", "referenceType", "referenceId");
CREATE INDEX "InventoryReservation_organizationId_status_createdAt_idx" ON "InventoryReservation"("organizationId", "status", "createdAt");
CREATE INDEX "InventoryReservation_balanceId_status_idx" ON "InventoryReservation"("balanceId", "status");
CREATE UNIQUE INDEX "InventoryReservation_organizationId_referenceType_reference_key" ON "InventoryReservation"("organizationId", "referenceType", "referenceId", "balanceId");
CREATE UNIQUE INDEX "InventoryReservation_id_organizationId_key" ON "InventoryReservation"("id", "organizationId");
CREATE UNIQUE INDEX "User_id_organizationId_key" ON "User"("id", "organizationId");
CREATE UNIQUE INDEX "Warehouse_id_organizationId_key" ON "Warehouse"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_warehouseId_organizationId_fkey" FOREIGN KEY ("warehouseId", "organizationId") REFERENCES "Warehouse"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_variantId_organizationId_fkey" FOREIGN KEY ("variantId", "organizationId") REFERENCES "ProductVariant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_balanceId_organizationId_fkey" FOREIGN KEY ("balanceId", "organizationId") REFERENCES "InventoryBalance"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorUserId_organizationId_fkey" FOREIGN KEY ("actorUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_balanceId_organizationId_fkey" FOREIGN KEY ("balanceId", "organizationId") REFERENCES "InventoryBalance"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_releasedByUserId_organizationId_fkey" FOREIGN KEY ("releasedByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain invariants
ALTER TABLE "InventoryBalance"
ADD CONSTRAINT "InventoryBalance_physical_nonnegative" CHECK ("physicalQuantity" >= 0),
ADD CONSTRAINT "InventoryBalance_reserved_nonnegative" CHECK ("reservedQuantity" >= 0),
ADD CONSTRAINT "InventoryBalance_reserved_not_above_physical" CHECK ("reservedQuantity" <= "physicalQuantity");

ALTER TABLE "InventoryMovement"
ADD CONSTRAINT "InventoryMovement_reason_not_blank" CHECK (length(btrim("reason")) > 0),
ADD CONSTRAINT "InventoryMovement_operation_not_blank" CHECK (length(btrim("operationId")) > 0),
ADD CONSTRAINT "InventoryMovement_reference_pair" CHECK (("referenceType" IS NULL) = ("referenceId" IS NULL)),
ADD CONSTRAINT "InventoryMovement_before_valid" CHECK ("physicalBefore" >= 0 AND "reservedBefore" >= 0 AND "reservedBefore" <= "physicalBefore"),
ADD CONSTRAINT "InventoryMovement_after_valid" CHECK ("physicalAfter" >= 0 AND "reservedAfter" >= 0 AND "reservedAfter" <= "physicalAfter"),
ADD CONSTRAINT "InventoryMovement_physical_arithmetic" CHECK ("physicalAfter" = "physicalBefore" + "physicalDelta"),
ADD CONSTRAINT "InventoryMovement_reserved_arithmetic" CHECK ("reservedAfter" = "reservedBefore" + "reservedDelta"),
ADD CONSTRAINT "InventoryMovement_delta_matches_type" CHECK (
  ("type" = 'ADJUSTMENT' AND "physicalDelta" <> 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_OUT' AND "physicalDelta" < 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_IN' AND "physicalDelta" > 0 AND "reservedDelta" = 0) OR
  ("type" = 'RESERVATION' AND "physicalDelta" = 0 AND "reservedDelta" > 0) OR
  ("type" = 'RELEASE' AND "physicalDelta" = 0 AND "reservedDelta" < 0)
);

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_quantity_positive" CHECK ("quantity" > 0),
ADD CONSTRAINT "InventoryReservation_reason_not_blank" CHECK (length(btrim("reason")) > 0),
ADD CONSTRAINT "InventoryReservation_reference_pair" CHECK (("referenceType" IS NULL) = ("referenceId" IS NULL)),
ADD CONSTRAINT "InventoryReservation_release_state" CHECK (
  ("status" = 'ACTIVE' AND "releasedByUserId" IS NULL AND "releaseReason" IS NULL AND "releasedAt" IS NULL) OR
  ("status" = 'RELEASED' AND "releasedByUserId" IS NOT NULL AND length(btrim("releaseReason")) > 0 AND "releasedAt" IS NOT NULL)
);

-- Ledger rows are append-only, including for direct SQL clients.
CREATE FUNCTION reject_inventory_movement_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'InventoryMovement is append-only';
END;
$$;

CREATE TRIGGER "InventoryMovement_append_only"
BEFORE UPDATE OR DELETE ON "InventoryMovement"
FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();
