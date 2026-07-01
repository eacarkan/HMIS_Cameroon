import "dotenv/config";

import { execSync } from "node:child_process";

/**
 * One-time setup of the dedicated TEST database: create it (if missing) and push the
 * Prisma schema. Safe — refuses any DB whose name doesn't contain "test".
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. See .env.example.");
  process.exit(1);
}

const parsed = new URL(url);
const dbName = parsed.pathname.slice(1).split("?")[0];
if (!/test/i.test(dbName)) {
  console.error(
    `Refusing: "${dbName}" is not a test database (name must contain "test").`,
  );
  process.exit(1);
}

try {
  execSync(
    `createdb -h ${parsed.hostname} -p ${parsed.port || 5432} -U ${parsed.username} ${dbName}`,
    { env: { ...process.env, PGPASSWORD: parsed.password }, stdio: "ignore" },
  );
  console.log(`✓ created database ${dbName}`);
} catch {
  console.log(`• database ${dbName} already exists (ok)`);
}

execSync("npx prisma db push", {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit",
});

// Phase 2D-5 — apply the non-negative stock CHECK constraints. These are raw-SQL invariants not
// representable in schema.prisma, so `db push` will not add them; the migrate path (dev/prod) gets
// them from migration `20260630120000_stock_nonnegative_check`. Idempotent (skips if already present).
const checkConstraintsSql = `
DO $$ BEGIN
  ALTER TABLE "MedicationStockBatch"
    ADD CONSTRAINT "MedicationStockBatch_quantityOnHand_nonneg" CHECK ("quantityOnHand" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MedicationStockBatch"
    ADD CONSTRAINT "MedicationStockBatch_quantityReserved_nonneg" CHECK ("quantityReserved" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Phase 2 hardening: at most one OPEN cashier shift per cashier (partial unique index; mirrors the
-- dev migration 20260630160000_cashier_shift_one_open).
CREATE UNIQUE INDEX IF NOT EXISTS "CashierShift_one_open_per_cashier"
  ON "CashierShift" ("hospitalId", "cashierId") WHERE "status" = 'open';
-- Phase 3F-5 hardening: a temporary-patient identifier is unique per hospital (concurrency-safe
-- numbering; mirrors the dev migration 20260630180000_temp_patient_unique).
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_temporary_identifier_unique"
  ON "Patient" ("hospitalId", "temporaryIdentifier") WHERE "temporaryIdentifier" IS NOT NULL;
-- Phase 4G: at most ONE ACTIVE duplicate candidate per (hospital, canonical pair), and no self-pairs
-- (mirrors the dev migration 20260701060000_phase4g_patient_matching).
CREATE UNIQUE INDEX IF NOT EXISTS "PatientMatchCandidate_active_pair_unique"
  ON "PatientMatchCandidate" ("hospitalId", "canonicalPairKey")
  WHERE "status" IN ('CANDIDATE', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION');
DO $$ BEGIN
  ALTER TABLE "PatientMatchCandidate"
    ADD CONSTRAINT "PatientMatchCandidate_not_self_pair" CHECK ("sourcePatientId" <> "candidatePatientId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;
// libpq's connection-URI parser rejects Prisma-specific query params (e.g. `?schema=public`), so pass
// psql the bare base URL (the schema defaults to "public" anyway).
const psqlUrl = url.split("?")[0];
execSync(`psql "${psqlUrl}" -v ON_ERROR_STOP=1`, {
  input: checkConstraintsSql,
  stdio: ["pipe", "inherit", "inherit"],
});
console.log("✓ test database schema is in sync (incl. non-negative stock constraints)");
