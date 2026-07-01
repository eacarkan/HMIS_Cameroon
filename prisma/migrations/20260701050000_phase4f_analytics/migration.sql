-- Phase 4F — advanced reporting / analytics foundation (ADDITIVE only; aggregate-only, no AI).
-- Configurable saved report definitions + on-demand / scheduled-PLACEHOLDER runs + an export registry.
-- Every run reuses the existing Phase 2E aggregate operational report (no nominative field) and stores
-- only aggregate rows. No AI/ML. No patient-level central disclosure (hospital-scoped). No existing-table change.

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('OPERATIONAL_SUMMARY', 'REVENUE_BY_METHOD', 'TOP_DIAGNOSES', 'AGE_GENDER');
CREATE TYPE "ReportRunTrigger" AS ENUM ('ON_DEMAND', 'SCHEDULED_PLACEHOLDER');
CREATE TYPE "ReportRunStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateTable
CREATE TABLE "ReportDefinition" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ReportKind" NOT NULL,
    "paramsJson" JSONB,
    "schedulePlaceholder" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "reportDefinitionId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "trigger" "ReportRunTrigger" NOT NULL DEFAULT 'ON_DEMAND',
    "status" "ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "runById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRunExport" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "format" "ReportExportFormat" NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "exportedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportRunExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportDefinition_hospitalId_code_key" ON "ReportDefinition"("hospitalId", "code");
CREATE INDEX "ReportDefinition_hospitalId_idx" ON "ReportDefinition"("hospitalId");
CREATE INDEX "ReportRun_hospitalId_reportDefinitionId_idx" ON "ReportRun"("hospitalId", "reportDefinitionId");
CREATE INDEX "ReportRun_hospitalId_status_idx" ON "ReportRun"("hospitalId", "status");
CREATE INDEX "ReportRunExport_hospitalId_reportRunId_idx" ON "ReportRunExport"("hospitalId", "reportRunId");

-- AddForeignKey
ALTER TABLE "ReportDefinition" ADD CONSTRAINT "ReportDefinition_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportRunExport" ADD CONSTRAINT "ReportRunExport_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "ReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
