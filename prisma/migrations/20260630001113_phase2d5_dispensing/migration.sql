-- AlterEnum
ALTER TYPE "SequenceType" ADD VALUE 'dispense';

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidById" TEXT;

-- CreateTable
CREATE TABLE "DispenseRecord" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "dispenseNumber" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "dispensedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispenseRecordItem" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "dispenseRecordId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "medicationLabel" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispenseRecordItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DispenseRecord_prescriptionId_idx" ON "DispenseRecord"("prescriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "DispenseRecord_hospitalId_dispenseNumber_key" ON "DispenseRecord"("hospitalId", "dispenseNumber");

-- CreateIndex
CREATE INDEX "DispenseRecordItem_dispenseRecordId_idx" ON "DispenseRecordItem"("dispenseRecordId");

-- CreateIndex
CREATE INDEX "DispenseRecordItem_batchId_idx" ON "DispenseRecordItem"("batchId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecord" ADD CONSTRAINT "DispenseRecord_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecord" ADD CONSTRAINT "DispenseRecord_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecord" ADD CONSTRAINT "DispenseRecord_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecordItem" ADD CONSTRAINT "DispenseRecordItem_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecordItem" ADD CONSTRAINT "DispenseRecordItem_dispenseRecordId_fkey" FOREIGN KEY ("dispenseRecordId") REFERENCES "DispenseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecordItem" ADD CONSTRAINT "DispenseRecordItem_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispenseRecordItem" ADD CONSTRAINT "DispenseRecordItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicationStockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
