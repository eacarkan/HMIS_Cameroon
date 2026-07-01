import type { CancellationRequestStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2C — invoice-cancellation request data-access (hospital-scoped). */

export type CreateCancellationRequestData = {
  hospitalId: string;
  invoiceId: string;
  reason: string;
  requestedById: string;
};

export function createCancellationRequest(data: CreateCancellationRequestData) {
  return prisma.invoiceCancellationRequest.create({ data });
}

export function findCancellationRequestById(hospitalId: string, id: string) {
  return prisma.invoiceCancellationRequest.findFirst({
    where: { id, hospitalId },
    include: {
      invoice: { include: { payments: true, encounter: { include: { patient: true } } } },
      requestedBy: true,
      decidedBy: true,
      refundVoucher: true,
    },
  });
}

/** Cancellation requests for the hospital (optionally filtered by status), newest first. */
export function listCancellationRequests(
  hospitalId: string,
  status?: CancellationRequestStatus,
) {
  return prisma.invoiceCancellationRequest.findMany({
    where: { hospitalId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: { include: { encounter: { include: { patient: true } } } },
      requestedBy: true,
      decidedBy: true,
      refundVoucher: true,
    },
  });
}

/** An existing PENDING (requested) cancellation for an invoice, if any (prevents duplicates). */
export function findPendingCancellationForInvoice(hospitalId: string, invoiceId: string) {
  return prisma.invoiceCancellationRequest.findFirst({
    where: { hospitalId, invoiceId, status: "requested" },
  });
}

export async function updateCancellationDecision(
  hospitalId: string,
  id: string,
  data: {
    status: CancellationRequestStatus;
    decidedById: string;
    decisionReason: string | null;
    decidedAt: Date;
  },
) {
  const res = await prisma.invoiceCancellationRequest.updateMany({
    where: { id, hospitalId, status: "requested" },
    data,
  });
  if (res.count === 0) throw new Error("Cette demande a déjà été traitée.");
  return res;
}

/**
 * Approve a cancellation ATOMICALLY: in ONE `$transaction`, claim the request (status-guarded
 * `requested → approved`), cancel the invoice + its recorded payments, and create the refund voucher
 * (when money was collected). If the status-guarded claim loses, the whole transaction aborts — so a
 * concurrent double-approval can never cancel twice or orphan a voucher.
 */
export async function approveCancellationTx(params: {
  hospitalId: string;
  requestId: string;
  invoiceId: string;
  decidedById: string;
  decisionReason: string | null;
  paidPaymentIds: string[];
  refund: { voucherNumber: string; amount: number; reason: string; requestedById: string } | null;
}): Promise<{ voucherId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.invoiceCancellationRequest.updateMany({
      where: { id: params.requestId, hospitalId: params.hospitalId, status: "requested" },
      data: {
        status: "approved",
        decidedById: params.decidedById,
        decisionReason: params.decisionReason,
        decidedAt: new Date(),
      },
    });
    if (claim.count === 0) throw new Error("Cette demande a déjà été traitée.");

    await tx.invoice.updateMany({
      where: { id: params.invoiceId, hospitalId: params.hospitalId },
      data: { status: "cancelled" },
    });
    if (params.paidPaymentIds.length > 0) {
      await tx.payment.updateMany({
        where: { id: { in: params.paidPaymentIds }, hospitalId: params.hospitalId },
        data: { status: "cancelled" },
      });
    }

    let voucherId: string | null = null;
    if (params.refund) {
      const v = await tx.refundVoucher.create({
        data: {
          hospitalId: params.hospitalId,
          voucherNumber: params.refund.voucherNumber,
          invoiceId: params.invoiceId,
          cancellationRequestId: params.requestId,
          amount: params.refund.amount,
          reason: params.refund.reason,
          requestedById: params.refund.requestedById,
        },
      });
      voucherId = v.id;
    }
    return { voucherId };
  });
}
