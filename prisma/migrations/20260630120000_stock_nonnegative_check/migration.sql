-- Phase 2D-5 review hardening: enforce the non-negative invariant on physical stock quantities at
-- the database level (defence-in-depth behind the application-layer guarded decrement in the
-- dispensing transaction). CHECK constraints are additive — they add no columns and drop nothing.
ALTER TABLE "MedicationStockBatch"
  ADD CONSTRAINT "MedicationStockBatch_quantityOnHand_nonneg" CHECK ("quantityOnHand" >= 0);

ALTER TABLE "MedicationStockBatch"
  ADD CONSTRAINT "MedicationStockBatch_quantityReserved_nonneg" CHECK ("quantityReserved" >= 0);
