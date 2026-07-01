-- Phase 4C — external lab/radiology result import framework (ADDITIVE only; STAGING, never clinical).
-- An imported result is a staging record (matched with warnings only, routed to a review queue); only
-- an authorized reviewer (≠ importer) promotes it into the clinical record via the existing Phase 2I
-- path. No analyzer/PACS/DICOM; nothing here writes the clinical result automatically. No existing-
-- table change; no patient data beyond hospital-scoped staging references.

-- CreateEnum
CREATE TYPE "ExternalResultStatus" AS ENUM ('NEEDS_REVIEW', 'PROMOTED', 'REJECTED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "ExternalResultImport" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "patientRef" TEXT NOT NULL,
    "orderRef" TEXT,
    "modality" TEXT NOT NULL,
    "testCode" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "status" "ExternalResultStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "matchedPatientId" TEXT,
    "matchedOrderId" TEXT,
    "matchWarning" TEXT,
    "importedById" TEXT,
    "reviewedById" TEXT,
    "reviewReason" TEXT,
    "promotedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalResultImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalResultImport_hospitalId_source_externalRef_key" ON "ExternalResultImport"("hospitalId", "source", "externalRef");
CREATE INDEX "ExternalResultImport_hospitalId_status_idx" ON "ExternalResultImport"("hospitalId", "status");

-- AddForeignKey
ALTER TABLE "ExternalResultImport" ADD CONSTRAINT "ExternalResultImport_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
