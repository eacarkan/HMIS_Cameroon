-- Phase 4D — payment provider abstraction (ADDITIVE only; mock only, no real API/production payment).
-- A hospital-scoped registry of MOCK payment providers + external payment transactions with a status
-- machine. A confirmation never silently marks an invoice paid; reconciliation records a controlled
-- Payment through the existing billing rule (recordPayment), preserving invoice snapshots + audit.
-- No changes to existing tables; integer FCFA.

-- CreateEnum
CREATE TYPE "ExternalPaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "ExternalPaymentProvider" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPaymentTransaction" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "externalReference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ExternalPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "invoiceId" TEXT,
    "reconciledPaymentId" TEXT,
    "payerRef" TEXT,
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPaymentProvider_hospitalId_code_key" ON "ExternalPaymentProvider"("hospitalId", "code");
CREATE INDEX "ExternalPaymentProvider_hospitalId_idx" ON "ExternalPaymentProvider"("hospitalId");
CREATE UNIQUE INDEX "ExternalPaymentTransaction_hospitalId_externalReference_key" ON "ExternalPaymentTransaction"("hospitalId", "externalReference");
CREATE INDEX "ExternalPaymentTransaction_hospitalId_status_idx" ON "ExternalPaymentTransaction"("hospitalId", "status");

-- AddForeignKey
ALTER TABLE "ExternalPaymentProvider" ADD CONSTRAINT "ExternalPaymentProvider_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalPaymentTransaction" ADD CONSTRAINT "ExternalPaymentTransaction_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalPaymentTransaction" ADD CONSTRAINT "ExternalPaymentTransaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalPaymentProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
