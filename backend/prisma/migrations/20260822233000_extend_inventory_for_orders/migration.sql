-- Enum values are committed in their own migration before later constraints use them.
ALTER TYPE "InventoryMovementType" ADD VALUE 'COMMIT';
ALTER TYPE "InventoryReservationStatus" ADD VALUE 'CONSUMED';
