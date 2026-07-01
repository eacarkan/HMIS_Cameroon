import type { ExternalPaymentStatus } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 4D — payment-provider data-access (hospital-scoped, integer FCFA). Mock providers + external
 * transactions with a status machine. Status transitions are GUARDED `updateMany` claims (from → to)
 * so a concurrent double-transition can't double-apply. Reconciliation links a controlled Payment id
 * (the actual Payment is created by the existing billing rule, never here).
 */

export function listExternalPaymentProviders(hospitalId: string) {
  return prisma.externalPaymentProvider.findMany({ where: { hospitalId }, orderBy: { code: "asc" } });
}

export function findExternalPaymentProviderById(hospitalId: string, id: string) {
  return prisma.externalPaymentProvider.findFirst({ where: { id, hospitalId } });
}

export function findExternalPaymentProviderByCode(hospitalId: string, code: string) {
  return prisma.externalPaymentProvider.findFirst({ where: { hospitalId, code } });
}

export function createExternalPaymentProvider(data: {
  hospitalId: string;
  code: string;
  name: string;
  channel: string;
  createdById?: string | null;
}) {
  return prisma.externalPaymentProvider.create({ data });
}

export function listExternalPaymentTransactions(hospitalId: string, opts: { limit?: number } = {}) {
  return prisma.externalPaymentTransaction.findMany({
    where: { hospitalId },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
    include: { provider: { select: { code: true, name: true, channel: true } } },
  });
}

export function findExternalPaymentTransactionById(hospitalId: string, id: string) {
  return prisma.externalPaymentTransaction.findFirst({ where: { id, hospitalId } });
}

export function findExternalPaymentTransactionByReference(hospitalId: string, externalReference: string) {
  return prisma.externalPaymentTransaction.findUnique({
    where: { hospitalId_externalReference: { hospitalId, externalReference } },
  });
}

export function createExternalPaymentTransaction(data: {
  hospitalId: string;
  providerId: string;
  externalReference: string;
  amount: number;
  invoiceId?: string | null;
  payerRef?: string | null;
  createdById?: string | null;
}) {
  return prisma.externalPaymentTransaction.create({ data });
}

/** Guarded status transition (from → to). Returns the update count (0 if the status was not `from`). */
export async function transitionExternalPaymentStatus(
  hospitalId: string,
  id: string,
  params: { from: ExternalPaymentStatus; to: ExternalPaymentStatus; lastError?: string | null },
): Promise<number> {
  const res = await prisma.externalPaymentTransaction.updateMany({
    where: { id, hospitalId, status: params.from },
    data: { status: params.to, lastError: params.lastError ?? null },
  });
  return res.count;
}

/**
 * Link the controlled Payment to a CONFIRMED, not-yet-reconciled transaction. Guarded so a concurrent
 * double-reconcile links at most once. Returns the update count (0 → already reconciled / not confirmed).
 */
export async function linkReconciledPayment(
  hospitalId: string,
  id: string,
  paymentId: string,
): Promise<number> {
  const res = await prisma.externalPaymentTransaction.updateMany({
    where: { id, hospitalId, status: "CONFIRMED", reconciledPaymentId: null },
    data: { reconciledPaymentId: paymentId },
  });
  return res.count;
}
