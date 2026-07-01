-- Phase 3E — UAT evidence & Gate 7 readiness package (additive only). Evidence-only; no changes
-- to existing tables. Three hospital-scoped models + the UatStatus enum.

-- CreateEnum
CREATE TYPE "UatStatus" AS ENUM ('not_run', 'pass', 'fail', 'blocker');

-- CreateTable
CREATE TABLE "UatScenario" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "titleFr" TEXT NOT NULL,
    "titleEn" TEXT,
    "expectedResult" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UatScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UatExecution" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" "UatStatus" NOT NULL DEFAULT 'not_run',
    "notes" TEXT,
    "executedById" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UatExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gate7ReadinessItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "criterion" TEXT NOT NULL,
    "status" "SiteReadinessStatus" NOT NULL DEFAULT 'not_started',
    "note" TEXT,
    "directorSignoffPlaceholder" TEXT,
    "minsanteSignoffPlaceholder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Gate7ReadinessItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UatScenario_hospitalId_code_key" ON "UatScenario"("hospitalId", "code");
CREATE INDEX "UatScenario_hospitalId_idx" ON "UatScenario"("hospitalId");
CREATE UNIQUE INDEX "UatExecution_hospitalId_scenarioId_key" ON "UatExecution"("hospitalId", "scenarioId");
CREATE INDEX "UatExecution_hospitalId_idx" ON "UatExecution"("hospitalId");
CREATE UNIQUE INDEX "Gate7ReadinessItem_hospitalId_criterion_key" ON "Gate7ReadinessItem"("hospitalId", "criterion");
CREATE INDEX "Gate7ReadinessItem_hospitalId_idx" ON "Gate7ReadinessItem"("hospitalId");

-- AddForeignKey
ALTER TABLE "UatScenario" ADD CONSTRAINT "UatScenario_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UatExecution" ADD CONSTRAINT "UatExecution_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UatExecution" ADD CONSTRAINT "UatExecution_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "UatScenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Gate7ReadinessItem" ADD CONSTRAINT "Gate7ReadinessItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
