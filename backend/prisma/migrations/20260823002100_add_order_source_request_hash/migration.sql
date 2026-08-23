ALTER TABLE "Order"
ADD COLUMN "sourceRequestHash" TEXT;

ALTER TABLE "Order"
DROP CONSTRAINT "Order_source_pair";

ALTER TABLE "Order"
ADD CONSTRAINT "Order_source_pair" CHECK (
  (
    "sourceIntegrationId" IS NULL
    AND "externalOrderId" IS NULL
    AND "sourceRequestHash" IS NULL
  )
  OR
  (
    "sourceIntegrationId" IS NOT NULL
    AND length(btrim("externalOrderId")) > 0
    AND "sourceRequestHash" ~ '^[0-9a-f]{64}$'
  )
);
