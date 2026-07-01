-- Phase 5.1 (F-02) — persisted failed-login lockout (ADDITIVE only; no destructive/renaming change).
-- N consecutive failed sign-ins lock a User until `lockedUntil`; a successful sign-in resets the counter.
-- Enforced in the credentials authorize path. Synthetic prototype only.

ALTER TABLE "User" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastSuccessfulLoginAt" TIMESTAMP(3);
