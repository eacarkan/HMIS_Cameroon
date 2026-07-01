-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('requested', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RefundVoucherStatus" AS ENUM ('requested', 'approved', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "CashierShiftStatus" AS ENUM ('open', 'closed', 'corrected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SequenceType" ADD VALUE 'refund_voucher';
ALTER TYPE "SequenceType" ADD VALUE 'cashier_shift';

-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "InvoiceCancellationRequest" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceCancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundVoucher" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "cancellationRequestId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "RefundVoucherStatus" NOT NULL DEFAULT 'requested',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "executedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShift" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "shiftNumber" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "status" "CashierShiftStatus" NOT NULL DEFAULT 'open',
    "openingBalance" INTEGER NOT NULL DEFAULT 0,
    "totalCashReceived" INTEGER NOT NULL DEFAULT 0,
    "totalMobileCardReceived" INTEGER NOT NULL DEFAULT 0,
    "totalCancellationsRefunds" INTEGER NOT NULL DEFAULT 0,
    "expectedClosingBalance" INTEGER NOT NULL DEFAULT 0,
    "receiptCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShiftCorrection" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "cashierShiftId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "correctedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierShiftCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceCancellationRequest_hospitalId_status_idx" ON "InvoiceCancellationRequest"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "InvoiceCancellationRequest_invoiceId_idx" ON "InvoiceCancellationRequest"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundVoucher_cancellationRequestId_key" ON "RefundVoucher"("cancellationRequestId");

-- CreateIndex
CREATE INDEX "RefundVoucher_hospitalId_status_idx" ON "RefundVoucher"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "RefundVoucher_invoiceId_idx" ON "RefundVoucher"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundVoucher_hospitalId_voucherNumber_key" ON "RefundVoucher"("hospitalId", "voucherNumber");

-- CreateIndex
CREATE INDEX "CashierShift_hospitalId_cashierId_status_idx" ON "CashierShift"("hospitalId", "cashierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CashierShift_hospitalId_shiftNumber_key" ON "CashierShift"("hospitalId", "shiftNumber");

-- CreateIndex
CREATE INDEX "CashierShiftCorrection_cashierShiftId_idx" ON "CashierShiftCorrection"("cashierShiftId");

-- AddForeignKey
ALTER TABLE "InvoiceCancellationRequest" ADD CONSTRAINT "InvoiceCancellationRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCancellationRequest" ADD CONSTRAINT "InvoiceCancellationRequest_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCancellationRequest" ADD CONSTRAINT "InvoiceCancellationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCancellationRequest" ADD CONSTRAINT "InvoiceCancellationRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_cancellationRequestId_fkey" FOREIGN KEY ("cancellationRequestId") REFERENCES "InvoiceCancellationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundVoucher" ADD CONSTRAINT "RefundVoucher_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftCorrection" ADD CONSTRAINT "CashierShiftCorrection_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftCorrection" ADD CONSTRAINT "CashierShiftCorrection_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftCorrection" ADD CONSTRAINT "CashierShiftCorrection_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
