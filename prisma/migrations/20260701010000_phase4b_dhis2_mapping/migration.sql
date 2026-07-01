-- Phase 4B — DHIS2 configurable export / API-readiness (ADDITIVE only; aggregate-only).
-- Hospital-scoped DHIS2 mapping SET (org-unit placeholder) + per-local-element mappings to DHIS2
-- data-element / category-option-combo PLACEHOLDERS (non-secret, non-final). No changes to existing
-- tables; no patient data. The manual CSV export (Phase 2E) is preserved.

-- CreateTable
CREATE TABLE "Dhis2MappingSet" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgUnitPlaceholder" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dhis2MappingSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dhis2Mapping" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "mappingSetId" TEXT NOT NULL,
    "localElement" TEXT NOT NULL,
    "dataElementPlaceholder" TEXT NOT NULL,
    "categoryOptionComboPlaceholder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dhis2Mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Dhis2MappingSet_hospitalId_code_key" ON "Dhis2MappingSet"("hospitalId", "code");
CREATE INDEX "Dhis2MappingSet_hospitalId_idx" ON "Dhis2MappingSet"("hospitalId");
CREATE UNIQUE INDEX "Dhis2Mapping_mappingSetId_localElement_key" ON "Dhis2Mapping"("mappingSetId", "localElement");
CREATE INDEX "Dhis2Mapping_hospitalId_idx" ON "Dhis2Mapping"("hospitalId");

-- AddForeignKey
ALTER TABLE "Dhis2MappingSet" ADD CONSTRAINT "Dhis2MappingSet_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dhis2Mapping" ADD CONSTRAINT "Dhis2Mapping_mappingSetId_fkey" FOREIGN KEY ("mappingSetId") REFERENCES "Dhis2MappingSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
