-- Phase 2 hardening (pre-Gate-7): at most ONE open cashier shift per cashier per hospital.
-- A partial unique index is not expressible in schema.prisma, so it lives here (and in
-- scripts/setup-test-db.ts for the db-push test environment), like the non-negative stock CHECKs.
CREATE UNIQUE INDEX IF NOT EXISTS "CashierShift_one_open_per_cashier"
  ON "CashierShift" ("hospitalId", "cashierId")
  WHERE "status" = 'open';
