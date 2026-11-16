-- Commit the new enum value before the next migration references it in a CHECK.
-- COMMIT retains its historical meaning: consuming a pre-existing reservation.
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE';
