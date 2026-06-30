-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'released', 'consumed');

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "prescriptionItemId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReservation_hospitalId_status_createdAt_idx" ON "StockReservation"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StockReservation_prescriptionId_idx" ON "StockReservation"("prescriptionId");

-- CreateIndex
CREATE INDEX "StockReservation_batchId_idx" ON "StockReservation"("batchId");

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicationStockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
