import type { RefundVoucherStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2C — refund voucher ("bon d'avoir") data-access (hospital-scoped, integer FCFA). */

export type CreateRefundVoucherData = {
  hospitalId: string;
  voucherNumber: string;
  invoiceId: string;
  cancellationRequestId: string;
  amount: number;
  reason: string;
  requestedById: string;
};

export function createRefundVoucher(data: CreateRefundVoucherData) {
  return prisma.refundVoucher.create({ data });
}

export function findRefundVoucherById(hospitalId: string, id: string) {
  return prisma.refundVoucher.findFirst({
    where: { id, hospitalId },
    include: {
      invoice: { include: { encounter: { include: { patient: true } } } },
      cancellationRequest: true,
      requestedBy: true,
      approvedBy: true,
      executedBy: true,
      cancelledBy: true,
    },
  });
}

export function listRefundVouchers(hospitalId: string, status?: RefundVoucherStatus) {
  return prisma.refundVoucher.findMany({
    where: { hospitalId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: { include: { encounter: { include: { patient: true } } } },
      requestedBy: true,
    },
  });
}

/** EXECUTED (status `paid`) refund vouchers within a [start, end) window, optionally by executor. */
export function findExecutedRefundsForWindow(
  hospitalId: string,
  start: Date,
  end: Date,
  executedById?: string,
) {
  return prisma.refundVoucher.findMany({
    where: {
      hospitalId,
      status: "paid",
      executedAt: { gte: start, lt: end },
      ...(executedById ? { executedById } : {}),
    },
  });
}

export function updateRefundVoucher(
  hospitalId: string,
  id: string,
  data: Partial<{
    status: RefundVoucherStatus;
    approvedById: string;
    approvedAt: Date;
    executedById: string;
    executedAt: Date;
    cancelledById: string;
    cancelledAt: Date;
  }>,
) {
  return prisma.refundVoucher.updateMany({ where: { id, hospitalId }, data });
}
