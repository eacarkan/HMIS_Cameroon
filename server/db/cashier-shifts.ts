import { prisma } from "./prisma";

/** Phase 2C — cashier shift / Brouillard de Caisse data-access (hospital-scoped, integer FCFA). */

export type CreateCashierShiftData = {
  hospitalId: string;
  shiftNumber: string;
  cashierId: string;
  openingBalance: number;
};

export function createCashierShift(data: CreateCashierShiftData) {
  return prisma.cashierShift.create({ data });
}

/** The cashier's currently OPEN shift, if any (only one open at a time per cashier). */
export function findOpenCashierShift(hospitalId: string, cashierId: string) {
  return prisma.cashierShift.findFirst({
    where: { hospitalId, cashierId, status: "open" },
  });
}

export function findCashierShiftById(hospitalId: string, id: string) {
  return prisma.cashierShift.findFirst({
    where: { id, hospitalId },
    include: {
      cashier: true,
      closedBy: true,
      corrections: { include: { correctedBy: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

export function listCashierShifts(hospitalId: string, cashierId?: string) {
  return prisma.cashierShift.findMany({
    where: { hospitalId, ...(cashierId ? { cashierId } : {}) },
    orderBy: { openedAt: "desc" },
    include: { cashier: true, corrections: true },
  });
}

/** All of a cashier's payments within a [start, end) window (status filtered by the caller's math). */
export function findCashierPaymentsForWindow(
  hospitalId: string,
  cashierId: string,
  start: Date,
  end: Date,
) {
  return prisma.payment.findMany({
    where: { hospitalId, cashierId, paidAt: { gte: start, lt: end } },
    orderBy: { paidAt: "asc" },
  });
}

export function closeCashierShiftRow(
  hospitalId: string,
  id: string,
  data: {
    closedById: string;
    closedAt: Date;
    totalCashReceived: number;
    totalMobileCardReceived: number;
    totalCancellationsRefunds: number;
    expectedClosingBalance: number;
    receiptCount: number;
  },
) {
  return prisma.cashierShift.updateMany({
    where: { id, hospitalId, status: "open" },
    data: { status: "closed", ...data },
  });
}

/** Flip a CLOSED/CORRECTED shift to `corrected`. The `status: { not: "open" }` guard prevents
 *  ever reverting a closed Brouillard back to open (immutability), and an open shift is never
 *  "corrected" (it must be closed first — enforced at the service layer too). */
export function markCashierShiftCorrected(hospitalId: string, id: string) {
  return prisma.cashierShift.updateMany({
    where: { id, hospitalId, status: { not: "open" } },
    data: { status: "corrected" },
  });
}

export type CreateShiftCorrectionData = {
  hospitalId: string;
  cashierShiftId: string;
  reason: string;
  note: string;
  correctedById: string;
};

export function createShiftCorrection(data: CreateShiftCorrectionData) {
  return prisma.cashierShiftCorrection.create({ data });
}
