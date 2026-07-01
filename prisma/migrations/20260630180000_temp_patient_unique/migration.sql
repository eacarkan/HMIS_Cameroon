-- Phase 3F-5 — identity hardening: a temporary-patient identifier (Inconnu_YYMMDD_NN) is UNIQUE
-- per hospital, so concurrent temporary-patient creation cannot mint duplicate identifiers.
-- Partial unique index (only rows that carry a temporaryIdentifier participate); additive, no
-- destructive change. Mirrored in scripts/setup-test-db.ts for the db-push test environment.
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_temporary_identifier_unique"
  ON "Patient" ("hospitalId", "temporaryIdentifier")
  WHERE "temporaryIdentifier" IS NOT NULL;
