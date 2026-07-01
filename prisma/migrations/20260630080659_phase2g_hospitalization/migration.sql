-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('requested', 'admitted', 'discharge_requested', 'discharged', 'cancelled');

-- AlterEnum
ALTER TYPE "SequenceType" ADD VALUE 'admission';

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "wardServiceUnitId" TEXT,
    "dailyWardFee" INTEGER NOT NULL DEFAULT 0,
    "dailyFeeTariffId" TEXT,
    "invoiceId" TEXT,
    "cancelReason" TEXT,
    "requestedById" TEXT,
    "admittedById" TEXT,
    "dischargedById" TEXT,
    "cancelledById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admittedAt" TIMESTAMP(3),
    "dischargeRequestedAt" TIMESTAMP(3),
    "dischargedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDailyCharge" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "chargeDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "invoiceItemId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDailyCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admission_invoiceId_key" ON "Admission"("invoiceId");

-- CreateIndex
CREATE INDEX "Admission_hospitalId_status_idx" ON "Admission"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "Admission_hospitalId_encounterId_idx" ON "Admission"("hospitalId", "encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_hospitalId_admissionNumber_key" ON "Admission"("hospitalId", "admissionNumber");

-- CreateIndex
CREATE INDEX "AdmissionDailyCharge_hospitalId_admissionId_idx" ON "AdmissionDailyCharge"("hospitalId", "admissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDailyCharge_hospitalId_admissionId_chargeDate_key" ON "AdmissionDailyCharge"("hospitalId", "admissionId", "chargeDate");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_wardServiceUnitId_fkey" FOREIGN KEY ("wardServiceUnitId") REFERENCES "ServiceUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDailyCharge" ADD CONSTRAINT "AdmissionDailyCharge_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDailyCharge" ADD CONSTRAINT "AdmissionDailyCharge_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
