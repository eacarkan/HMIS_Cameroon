-- Phase 3D — central aggregate oversight (additive). Aggregate-only per-hospital snapshot; the
-- ONLY table the central viewer reads. No patient-level data; no changes to existing tables.

-- CreateTable
CREATE TABLE "HospitalAggregateSnapshot" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalAggregateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HospitalAggregateSnapshot_hospitalId_period_key" ON "HospitalAggregateSnapshot"("hospitalId", "period");

-- CreateIndex
CREATE INDEX "HospitalAggregateSnapshot_hospitalId_idx" ON "HospitalAggregateSnapshot"("hospitalId");

-- AddForeignKey
ALTER TABLE "HospitalAggregateSnapshot" ADD CONSTRAINT "HospitalAggregateSnapshot_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
