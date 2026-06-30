-- CreateEnum
CREATE TYPE "EmergencyDebtStatus" AS ENUM ('outstanding', 'settled', 'waived');

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "emergencyFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "emergencyFlaggedById" TEXT,
ADD COLUMN     "isEmergency" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmergencyDebt" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "status" "EmergencyDebtStatus" NOT NULL DEFAULT 'outstanding',
    "createdById" TEXT,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyDebt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmergencyDebt_hospitalId_encounterId_status_idx" ON "EmergencyDebt"("hospitalId", "encounterId", "status");

-- AddForeignKey
ALTER TABLE "EmergencyDebt" ADD CONSTRAINT "EmergencyDebt_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDebt" ADD CONSTRAINT "EmergencyDebt_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyDebt" ADD CONSTRAINT "EmergencyDebt_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
