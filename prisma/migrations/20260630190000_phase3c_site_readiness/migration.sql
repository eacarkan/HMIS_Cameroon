-- Phase 3C — site readiness & deployment checklist (additive only). Status-tracking model;
-- one row per (hospital, category). No changes to existing tables.

-- CreateEnum
CREATE TYPE "SiteReadinessStatus" AS ENUM ('not_started', 'in_progress', 'ready', 'blocked', 'not_applicable', 'needs_validation');

-- CreateTable
CREATE TABLE "SiteReadinessItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "SiteReadinessStatus" NOT NULL DEFAULT 'not_started',
    "owner" TEXT,
    "evidenceNote" TEXT,
    "verifier" TEXT,
    "statusDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteReadinessItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteReadinessItem_hospitalId_category_key" ON "SiteReadinessItem"("hospitalId", "category");

-- CreateIndex
CREATE INDEX "SiteReadinessItem_hospitalId_idx" ON "SiteReadinessItem"("hospitalId");

-- AddForeignKey
ALTER TABLE "SiteReadinessItem" ADD CONSTRAINT "SiteReadinessItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
