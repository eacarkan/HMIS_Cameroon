-- Phase 3A — multi-hospital configuration foundation (additive only).
-- Two new tables: hospital-agnostic configuration templates (blueprints, no patient data,
-- no hospital identity) and audit-grade records of guarded, hospital-scoped template applies.
-- No changes to existing tables/columns; Phase 1A/2 data is preserved.

-- CreateTable
CREATE TABLE "ConfigurationTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceHospitalId" TEXT,
    "content" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigurationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationTemplateApplication" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "appliedById" TEXT NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationTemplateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationTemplate_code_key" ON "ConfigurationTemplate"("code");

-- CreateIndex
CREATE INDEX "ConfigurationTemplate_sourceHospitalId_idx" ON "ConfigurationTemplate"("sourceHospitalId");

-- CreateIndex
CREATE INDEX "ConfigurationTemplateApplication_hospitalId_idx" ON "ConfigurationTemplateApplication"("hospitalId");

-- CreateIndex
CREATE INDEX "ConfigurationTemplateApplication_templateId_idx" ON "ConfigurationTemplateApplication"("templateId");

-- AddForeignKey
ALTER TABLE "ConfigurationTemplateApplication" ADD CONSTRAINT "ConfigurationTemplateApplication_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationTemplateApplication" ADD CONSTRAINT "ConfigurationTemplateApplication_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ConfigurationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
