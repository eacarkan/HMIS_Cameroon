-- Phase 4G — patient-matching / MPI readiness (ADDITIVE only; local, warning-only, no auto-merge).
-- A separate model from the Phase 1 PatientDuplicateCandidate (which stays untouched): this one carries
-- a CANONICAL pair key (A→B ≡ B→A), explainable signals, a score, and the manual review state machine.
-- No live MPI (mock adapter is lib-level, no network). No existing-table change. No national identifier.

-- CreateEnum
CREATE TYPE "PatientMatchStatus" AS ENUM ('CANDIDATE', 'UNDER_REVIEW', 'MARKED_DUPLICATE', 'MARKED_NOT_DUPLICATE', 'NEEDS_MORE_INFORMATION', 'DISMISSED');

-- CreateTable
CREATE TABLE "PatientMatchCandidate" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "sourcePatientId" TEXT NOT NULL,
    "candidatePatientId" TEXT NOT NULL,
    "canonicalPairKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" JSONB NOT NULL,
    "status" "PatientMatchStatus" NOT NULL DEFAULT 'CANDIDATE',
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientMatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientMatchCandidate_hospitalId_status_idx" ON "PatientMatchCandidate"("hospitalId", "status");
CREATE INDEX "PatientMatchCandidate_hospitalId_canonicalPairKey_idx" ON "PatientMatchCandidate"("hospitalId", "canonicalPairKey");

-- AddForeignKey
ALTER TABLE "PatientMatchCandidate" ADD CONSTRAINT "PatientMatchCandidate_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientMatchCandidate" ADD CONSTRAINT "PatientMatchCandidate_sourcePatientId_fkey" FOREIGN KEY ("sourcePatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PatientMatchCandidate" ADD CONSTRAINT "PatientMatchCandidate_candidatePatientId_fkey" FOREIGN KEY ("candidatePatientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 4G safety constraints (not expressible in schema.prisma; mirrored in scripts/setup-test-db.ts):
--  * at most ONE ACTIVE candidate per (hospital, canonical pair) — active = not yet decided/dismissed;
--  * reject self-pairs (source == candidate) at the DB layer.
CREATE UNIQUE INDEX "PatientMatchCandidate_active_pair_unique"
  ON "PatientMatchCandidate" ("hospitalId", "canonicalPairKey")
  WHERE "status" IN ('CANDIDATE', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION');
ALTER TABLE "PatientMatchCandidate"
  ADD CONSTRAINT "PatientMatchCandidate_not_self_pair" CHECK ("sourcePatientId" <> "candidatePatientId");
