-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('OUTPATIENT', 'INPATIENT_WARD', 'SUPPORT', 'CASHIER', 'PHARMACY', 'LABORATORY', 'IMAGING', 'EMERGENCY', 'ADMINISTRATION');

-- AlterTable
ALTER TABLE "ServiceUnit" ADD COLUMN     "acceptsConsultation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acceptsQueue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isInpatientWard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameEn" TEXT,
ADD COLUMN     "nameFr" TEXT,
ADD COLUMN     "supportsBilling" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsImaging" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsLab" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsPharmacy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "ServiceType" NOT NULL DEFAULT 'SUPPORT';

-- CreateIndex
CREATE INDEX "ServiceUnit_hospitalId_type_idx" ON "ServiceUnit"("hospitalId", "type");
