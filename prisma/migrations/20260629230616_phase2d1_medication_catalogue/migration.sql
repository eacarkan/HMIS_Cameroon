-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameFr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "strength" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Medication_hospitalId_isActive_displayOrder_idx" ON "Medication"("hospitalId", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Medication_hospitalId_code_key" ON "Medication"("hospitalId", "code");

-- AddForeignKey
ALTER TABLE "Medication" ADD CONSTRAINT "Medication_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
