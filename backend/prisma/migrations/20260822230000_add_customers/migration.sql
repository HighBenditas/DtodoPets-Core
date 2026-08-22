-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rut" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "commune" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT,
    "instructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_active_name_idx" ON "Customer"("organizationId", "active", "name");
CREATE UNIQUE INDEX "Customer_organizationId_email_key" ON "Customer"("organizationId", "email");
CREATE UNIQUE INDEX "Customer_organizationId_phone_key" ON "Customer"("organizationId", "phone");
CREATE UNIQUE INDEX "Customer_organizationId_rut_key" ON "Customer"("organizationId", "rut");
CREATE UNIQUE INDEX "Customer_id_organizationId_key" ON "Customer"("id", "organizationId");
CREATE INDEX "CustomerAddress_organizationId_active_idx" ON "CustomerAddress"("organizationId", "active");
CREATE INDEX "CustomerAddress_customerId_active_isDefault_idx" ON "CustomerAddress"("customerId", "active", "isDefault");
CREATE UNIQUE INDEX "CustomerAddress_customerId_label_key" ON "CustomerAddress"("customerId", "label");
CREATE UNIQUE INDEX "CustomerAddress_id_organizationId_key" ON "CustomerAddress"("id", "organizationId");
CREATE UNIQUE INDEX "CustomerAddress_one_active_default_key" ON "CustomerAddress"("customerId") WHERE "active" AND "isDefault";

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_organizationId_fkey" FOREIGN KEY ("customerId", "organizationId") REFERENCES "Customer"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain constraints
ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_name_not_blank" CHECK (length(btrim("name")) > 0),
ADD CONSTRAINT "Customer_email_normalized" CHECK ("email" IS NULL OR ("email" = lower(btrim("email")) AND position('@' IN "email") > 1)),
ADD CONSTRAINT "Customer_phone_normalized" CHECK ("phone" IS NULL OR "phone" ~ '^\+56[2-9][0-9]{8}$'),
ADD CONSTRAINT "Customer_rut_normalized" CHECK ("rut" IS NULL OR "rut" ~ '^[0-9]{7,8}-[0-9K]$');

ALTER TABLE "CustomerAddress"
ADD CONSTRAINT "CustomerAddress_label_not_blank" CHECK (length(btrim("label")) > 0),
ADD CONSTRAINT "CustomerAddress_recipient_not_blank" CHECK (length(btrim("recipientName")) > 0),
ADD CONSTRAINT "CustomerAddress_line1_not_blank" CHECK (length(btrim("addressLine1")) > 0),
ADD CONSTRAINT "CustomerAddress_commune_not_blank" CHECK (length(btrim("commune")) > 0),
ADD CONSTRAINT "CustomerAddress_city_not_blank" CHECK (length(btrim("city")) > 0),
ADD CONSTRAINT "CustomerAddress_region_not_blank" CHECK (length(btrim("region")) > 0),
ADD CONSTRAINT "CustomerAddress_phone_normalized" CHECK ("phone" IS NULL OR "phone" ~ '^\+56[2-9][0-9]{8}$'),
ADD CONSTRAINT "CustomerAddress_default_is_active" CHECK (NOT "isDefault" OR "active");
