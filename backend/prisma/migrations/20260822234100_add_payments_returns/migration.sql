-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'STORE_CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CAPTURED',
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "amount" DECIMAL(14,0) NOT NULL,
    "provider" TEXT NOT NULL,
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRefund" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "amount" DECIMAL(14,0) NOT NULL,
    "reason" TEXT NOT NULL,
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderReturnItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderReturnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "restocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_organizationId_status_createdAt_idx" ON "Payment"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orderId_createdAt_idx" ON "Payment"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_idempotencyKey_key" ON "Payment"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_organizationId_provider_externalReference_key" ON "Payment"("organizationId", "provider", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_id_organizationId_key" ON "Payment"("id", "organizationId");

-- CreateIndex
CREATE INDEX "PaymentRefund_organizationId_createdAt_idx" ON "PaymentRefund"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentRefund_paymentId_createdAt_idx" ON "PaymentRefund"("paymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_organizationId_idempotencyKey_key" ON "PaymentRefund"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_paymentId_externalReference_key" ON "PaymentRefund"("paymentId", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_id_organizationId_key" ON "PaymentRefund"("id", "organizationId");

-- CreateIndex
CREATE INDEX "OrderReturn_organizationId_createdAt_idx" ON "OrderReturn"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturn_orderId_createdAt_idx" ON "OrderReturn"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturn_organizationId_number_key" ON "OrderReturn"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturn_organizationId_idempotencyKey_key" ON "OrderReturn"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturn_id_organizationId_key" ON "OrderReturn"("id", "organizationId");

-- CreateIndex
CREATE INDEX "OrderReturnItem_organizationId_createdAt_idx" ON "OrderReturnItem"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderReturnItem_orderItemId_createdAt_idx" ON "OrderReturnItem"("orderItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturnItem_orderReturnId_orderItemId_key" ON "OrderReturnItem"("orderReturnId", "orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderReturnItem_id_organizationId_key" ON "OrderReturnItem"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_organizationId_fkey" FOREIGN KEY ("paymentId", "organizationId") REFERENCES "Payment"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_organizationId_fkey" FOREIGN KEY ("orderId", "organizationId") REFERENCES "Order"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_createdByUserId_organizationId_fkey" FOREIGN KEY ("createdByUserId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_orderReturnId_organizationId_fkey" FOREIGN KEY ("orderReturnId", "organizationId") REFERENCES "OrderReturn"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturnItem" ADD CONSTRAINT "OrderReturnItem_orderItemId_organizationId_fkey" FOREIGN KEY ("orderItemId", "organizationId") REFERENCES "OrderItem"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extend the immutable inventory ledger for stock returned by customers.
ALTER TABLE "InventoryMovement"
DROP CONSTRAINT "InventoryMovement_delta_matches_type",
ADD CONSTRAINT "InventoryMovement_delta_matches_type" CHECK (
  ("type" = 'ADJUSTMENT' AND "physicalDelta" <> 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_OUT' AND "physicalDelta" < 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_IN' AND "physicalDelta" > 0 AND "reservedDelta" = 0) OR
  ("type" = 'RESERVATION' AND "physicalDelta" = 0 AND "reservedDelta" > 0) OR
  ("type" = 'RELEASE' AND "physicalDelta" = 0 AND "reservedDelta" < 0) OR
  ("type" = 'COMMIT' AND "physicalDelta" < 0 AND "reservedDelta" = "physicalDelta") OR
  ("type" = 'RETURN' AND "physicalDelta" > 0 AND "reservedDelta" = 0)
);

-- Domain constraints for exact CLP amounts, idempotency and return quantities.
ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_currency_clp" CHECK ("currency" = 'CLP'),
ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "Payment_provider_not_blank" CHECK (length(btrim("provider")) > 0),
ADD CONSTRAINT "Payment_idempotency_not_blank" CHECK (length(btrim("idempotencyKey")) > 0),
ADD CONSTRAINT "Payment_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "Payment_external_reference_not_blank" CHECK ("externalReference" IS NULL OR length(btrim("externalReference")) > 0);

ALTER TABLE "PaymentRefund"
ADD CONSTRAINT "PaymentRefund_currency_clp" CHECK ("currency" = 'CLP'),
ADD CONSTRAINT "PaymentRefund_amount_positive" CHECK ("amount" > 0),
ADD CONSTRAINT "PaymentRefund_reason_not_blank" CHECK (length(btrim("reason")) > 0),
ADD CONSTRAINT "PaymentRefund_idempotency_not_blank" CHECK (length(btrim("idempotencyKey")) > 0),
ADD CONSTRAINT "PaymentRefund_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
ADD CONSTRAINT "PaymentRefund_external_reference_not_blank" CHECK ("externalReference" IS NULL OR length(btrim("externalReference")) > 0);

ALTER TABLE "OrderReturn"
ADD CONSTRAINT "OrderReturn_number_not_blank" CHECK (length(btrim("number")) > 0),
ADD CONSTRAINT "OrderReturn_reason_not_blank" CHECK (length(btrim("reason")) > 0),
ADD CONSTRAINT "OrderReturn_idempotency_not_blank" CHECK (length(btrim("idempotencyKey")) > 0),
ADD CONSTRAINT "OrderReturn_request_hash_format" CHECK ("requestHash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "OrderReturnItem"
ADD CONSTRAINT "OrderReturnItem_quantity_positive" CHECK ("quantity" > 0);
