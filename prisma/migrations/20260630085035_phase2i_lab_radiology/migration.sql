-- CreateEnum
CREATE TYPE "DiagnosticModality" AS ENUM ('lab', 'radiology');

-- CreateEnum
CREATE TYPE "DiagnosticOrderStatus" AS ENUM ('requested', 'payment_confirmed', 'in_progress', 'result_entered', 'validated', 'cancelled');

-- AlterEnum
ALTER TYPE "SequenceType" ADD VALUE 'diagnostic';

-- CreateTable
CREATE TABLE "DiagnosticCatalogueItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT,
    "modality" "DiagnosticModality" NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticCatalogueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticOrder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "catalogueItemId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "modality" "DiagnosticModality" NOT NULL,
    "itemLabel" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "status" "DiagnosticOrderStatus" NOT NULL DEFAULT 'requested',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "resultText" TEXT,
    "resultEnteredById" TEXT,
    "resultEnteredAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiagnosticCatalogueItem_hospitalId_modality_idx" ON "DiagnosticCatalogueItem"("hospitalId", "modality");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticCatalogueItem_hospitalId_code_key" ON "DiagnosticCatalogueItem"("hospitalId", "code");

-- CreateIndex
CREATE INDEX "DiagnosticOrder_hospitalId_status_idx" ON "DiagnosticOrder"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "DiagnosticOrder_hospitalId_encounterId_idx" ON "DiagnosticOrder"("hospitalId", "encounterId");

-- CreateIndex
CREATE INDEX "DiagnosticOrder_hospitalId_modality_status_idx" ON "DiagnosticOrder"("hospitalId", "modality", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticOrder_hospitalId_orderNumber_key" ON "DiagnosticOrder"("hospitalId", "orderNumber");

-- AddForeignKey
ALTER TABLE "DiagnosticCatalogueItem" ADD CONSTRAINT "DiagnosticCatalogueItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_catalogueItemId_fkey" FOREIGN KEY ("catalogueItemId") REFERENCES "DiagnosticCatalogueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
