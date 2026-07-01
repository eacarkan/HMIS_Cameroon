-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "serviceUnitId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "estimatedAge" INTEGER,
ADD COLUMN     "guardianPhone" TEXT,
ADD COLUMN     "isEstimatedAge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isTemporaryIdentity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "temporaryIdentifier" TEXT;

-- CreateTable
CREATE TABLE "DiagnosisCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelFr" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosisCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosisCode_code_key" ON "DiagnosisCode"("code");

-- CreateIndex
CREATE INDEX "DiagnosisCode_isActive_displayOrder_idx" ON "DiagnosisCode"("isActive", "displayOrder");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_serviceUnitId_fkey" FOREIGN KEY ("serviceUnitId") REFERENCES "ServiceUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
