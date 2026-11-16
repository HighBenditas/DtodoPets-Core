-- Extend the ledger atomically without weakening any existing movement rule.
ALTER TABLE "InventoryMovement"
DROP CONSTRAINT "InventoryMovement_delta_matches_type",
ADD CONSTRAINT "InventoryMovement_delta_matches_type" CHECK (
  ("type" = 'ADJUSTMENT' AND "physicalDelta" <> 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_OUT' AND "physicalDelta" < 0 AND "reservedDelta" = 0) OR
  ("type" = 'TRANSFER_IN' AND "physicalDelta" > 0 AND "reservedDelta" = 0) OR
  ("type" = 'RESERVATION' AND "physicalDelta" = 0 AND "reservedDelta" > 0) OR
  ("type" = 'RELEASE' AND "physicalDelta" = 0 AND "reservedDelta" < 0) OR
  ("type" = 'COMMIT' AND "physicalDelta" < 0 AND "reservedDelta" = "physicalDelta") OR
  ("type" = 'RETURN' AND "physicalDelta" > 0 AND "reservedDelta" = 0) OR
  ("type" = 'SALE' AND "physicalDelta" < 0 AND "reservedDelta" = 0)
);
