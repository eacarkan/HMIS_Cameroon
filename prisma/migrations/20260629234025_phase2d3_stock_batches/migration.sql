-- CreateTable
CREATE TABLE "MedicationStockBatch" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" DATE NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityOnHand" INTEGER NOT NULL,
    "quantityReserved" INTEGER NOT NULL DEFAULT 0,
    "receivedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationStockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MedicationStockBatch_hospitalId_medicationId_expiryDate_idx" ON "MedicationStockBatch"("hospitalId", "medicationId", "expiryDate");

-- AddForeignKey
ALTER TABLE "MedicationStockBatch" ADD CONSTRAINT "MedicationStockBatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationStockBatch" ADD CONSTRAINT "MedicationStockBatch_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
