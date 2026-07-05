-- Phase 6.6 — Finance / bank reconciliation (ADDITIVE only; metadata overlay, synthetic, no live feed).
-- New enums (DepositSlipStatus, BankLineMatchStatus); two NULLABLE Mobile-Money snapshot columns on
-- Payment (metadata, NOT money fields); two additive SequenceType values (deposit_slip, revenue_statement
-- — revenue_statement is unused until Unit 5 but ships here so ALL Phase 6.6 schema is ONE migration);
-- four new hospital-scoped, soft-deletable tables (DepositSlip, DepositSlipPayment, BankStatementLine,
-- BankReconciliationMatch). NO existing column is renamed/dropped/retyped — backward-compatible, so the
-- migrate-before-code sequence is safe (old code keeps working against the migrated DB).
--
-- The overlay NEVER writes Invoice/Payment money fields — recording money stays recordPayment →
-- recordPaymentTx (F-01). Domain rules (status transitions, no over-match, cross-hospital rejection,
-- cleared-only-when-reconciled) live in lib/finance and the Unit-4 services; the positive-amount CHECKs
-- below are the DB-expressible money invariants (mirrored in scripts/setup-test-db.ts, per the 4G/2D-5
-- precedent — raw SQL not representable in schema.prisma).

-- CreateEnum
CREATE TYPE "DepositSlipStatus" AS ENUM ('prepared', 'deposited', 'cleared', 'disputed');

-- CreateEnum
CREATE TYPE "BankLineMatchStatus" AS ENUM ('unmatched', 'matched', 'disputed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SequenceType" ADD VALUE 'deposit_slip';
ALTER TYPE "SequenceType" ADD VALUE 'revenue_statement';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "mobileMoneyOperator" TEXT,
ADD COLUMN     "mobileMoneyReference" TEXT;

-- CreateTable
CREATE TABLE "DepositSlip" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "slipNumber" TEXT NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "status" "DepositSlipStatus" NOT NULL DEFAULT 'prepared',
    "declaredTotalFcfa" INTEGER NOT NULL DEFAULT 0,
    "computedPaymentTotalFcfa" INTEGER NOT NULL DEFAULT 0,
    "clearedAmountFcfa" INTEGER NOT NULL DEFAULT 0,
    "varianceFcfa" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositSlipPayment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "depositSlipId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "linkedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositSlipPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "valueDate" TIMESTAMP(3) NOT NULL,
    "amountFcfa" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "reference" TEXT,
    "matchStatus" "BankLineMatchStatus" NOT NULL DEFAULT 'unmatched',
    "importBatchId" TEXT,
    "isMock" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliationMatch" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "bankStatementLineId" TEXT NOT NULL,
    "depositSlipId" TEXT NOT NULL,
    "matchedAmountFcfa" INTEGER NOT NULL,
    "matchedById" TEXT,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankReconciliationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositSlip_hospitalId_status_idx" ON "DepositSlip"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "DepositSlip_hospitalId_depositDate_idx" ON "DepositSlip"("hospitalId", "depositDate");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSlip_hospitalId_slipNumber_key" ON "DepositSlip"("hospitalId", "slipNumber");

-- CreateIndex
CREATE INDEX "DepositSlipPayment_depositSlipId_idx" ON "DepositSlipPayment"("depositSlipId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSlipPayment_hospitalId_paymentId_key" ON "DepositSlipPayment"("hospitalId", "paymentId");

-- CreateIndex
CREATE INDEX "BankStatementLine_hospitalId_matchStatus_idx" ON "BankStatementLine"("hospitalId", "matchStatus");

-- CreateIndex
CREATE INDEX "BankStatementLine_hospitalId_valueDate_idx" ON "BankStatementLine"("hospitalId", "valueDate");

-- CreateIndex
CREATE INDEX "BankStatementLine_hospitalId_importBatchId_idx" ON "BankStatementLine"("hospitalId", "importBatchId");

-- CreateIndex
CREATE INDEX "BankReconciliationMatch_hospitalId_bankStatementLineId_idx" ON "BankReconciliationMatch"("hospitalId", "bankStatementLineId");

-- CreateIndex
CREATE INDEX "BankReconciliationMatch_hospitalId_depositSlipId_idx" ON "BankReconciliationMatch"("hospitalId", "depositSlipId");

-- AddForeignKey
ALTER TABLE "DepositSlip" ADD CONSTRAINT "DepositSlip_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSlipPayment" ADD CONSTRAINT "DepositSlipPayment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSlipPayment" ADD CONSTRAINT "DepositSlipPayment_depositSlipId_fkey" FOREIGN KEY ("depositSlipId") REFERENCES "DepositSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSlipPayment" ADD CONSTRAINT "DepositSlipPayment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_bankStatementLineId_fkey" FOREIGN KEY ("bankStatementLineId") REFERENCES "BankStatementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_depositSlipId_fkey" FOREIGN KEY ("depositSlipId") REFERENCES "DepositSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Phase 6.6 finance safety constraints (integer-FCFA money invariants; not expressible in
-- schema.prisma). Deposit-slip snapshot totals are non-negative; a synthetic bank line is
-- non-negative; a reconciliation match moves a strictly-positive amount. `varianceFcfa`
-- (declared − computed) is intentionally UNCONSTRAINED (it may legitimately be negative).
ALTER TABLE "DepositSlip"
  ADD CONSTRAINT "DepositSlip_declaredTotalFcfa_nonneg" CHECK ("declaredTotalFcfa" >= 0);
ALTER TABLE "DepositSlip"
  ADD CONSTRAINT "DepositSlip_computedPaymentTotalFcfa_nonneg" CHECK ("computedPaymentTotalFcfa" >= 0);
ALTER TABLE "DepositSlip"
  ADD CONSTRAINT "DepositSlip_clearedAmountFcfa_nonneg" CHECK ("clearedAmountFcfa" >= 0);
ALTER TABLE "BankStatementLine"
  ADD CONSTRAINT "BankStatementLine_amountFcfa_nonneg" CHECK ("amountFcfa" >= 0);
ALTER TABLE "BankReconciliationMatch"
  ADD CONSTRAINT "BankReconciliationMatch_matchedAmountFcfa_positive" CHECK ("matchedAmountFcfa" > 0);
