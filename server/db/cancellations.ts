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

export function updateCancellationDecision(
  hospitalId: string,
  id: string,
  data: {
    status: CancellationRequestStatus;
    decidedById: string;
    decisionReason: string | null;
    decidedAt: Date;
  },
) {
  return prisma.invoiceCancellationRequest.updateMany({ where: { id, hospitalId }, data });
}
