import { canVoidInvoice } from "@/lib/billing-rules";
import {
  canDecideCancellation,
  isSeparateApprover,
  isValidCancellationReason,
} from "@/lib/cancellation-rules";
import { formatFcfa, sumFcfa } from "@/lib/money";
import {
  createCancellationRequest,
  createRefundVoucher,
  findCancellationRequestById,
  findInvoiceById,
  findPendingCancellationForInvoice,
  listCancellationRequests as listCancellationRequestsDb,
  updateCancellationDecision,
  updateInvoiceStatus,
  updatePaymentStatus,
  type HospitalContext,
} from "@/server/db";
import type { CancellationRequestStatus } from "@prisma/client";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Phase 2C — controlled invoice-cancellation workflow. A cashier REQUESTS a cancellation with a
 * mandatory reason; a Hospital Administrator APPROVES or REJECTS it. The requester may not approve
 * their own request (cashier ≠ approver). Approving a PAID invoice generates a linked RefundVoucher.
 * InvoiceItem snapshots are never modified — cancellation is a controlled state change, not a rewrite.
 */

export async function listCancellations(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  status?: CancellationRequestStatus,
) {
  await requireCapability(actor, ctx, "invoice.read");
  return listCancellationRequestsDb(ctx.hospitalId, status);
}

export async function getCancellation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "invoice.read");
  return findCancellationRequestById(ctx.hospitalId, id);
}

/** Cashier requests an invoice cancellation (mandatory reason). One pending request per invoice. */
export async function requestInvoiceCancellation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  invoiceId: string,
  reason: string,
) {
  await requireCapability(actor, ctx, "invoice.cancel.request", { type: "Invoice", id: invoiceId });

  const invoice = await findInvoiceById(ctx.hospitalId, invoiceId);
  if (!invoice) throw new Error("Facture introuvable dans cet hôpital.");
  if (!canVoidInvoice(invoice.status)) throw new Error("Cette facture est déjà annulée.");
  if (!isValidCancellationReason(reason)) {
    throw new Error("Le motif d'annulation est obligatoire.");
  }
  const pending = await findPendingCancellationForInvoice(ctx.hospitalId, invoiceId);
  if (pending) throw new Error("Une demande d'annulation est déjà en attente pour cette facture.");

  const request = await createCancellationRequest({
    hospitalId: ctx.hospitalId,
    invoiceId,
    reason: reason.trim(),
    requestedById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.invoiceCancellationRequested,
    entityType: "InvoiceCancellationRequest",
    entityId: request.id,
    summary: `Demande d'annulation de la facture ${invoice.invoiceNumber} — motif : ${reason.trim()}`,
  });
  return request;
}

/**
 * Administrator approves a cancellation: the invoice (and its recorded payments) are cancelled, and
 * when the invoice had recorded payments a RefundVoucher is generated for the collected amount.
 * Enforces requester ≠ approver. The InvoiceItem snapshots are untouched.
 */
export async function approveInvoiceCancellation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  requestId: string,
  decisionReason?: string,
) {
  await requireCapability(actor, ctx, "invoice.cancel.approve", {
    type: "InvoiceCancellationRequest",
    id: requestId,
  });

  const request = await findCancellationRequestById(ctx.hospitalId, requestId);
  if (!request) throw new Error("Demande d'annulation introuvable dans cet hôpital.");
  if (!canDecideCancellation(request.status)) {
    throw new Error("Cette demande a déjà été traitée.");
  }
  if (!isSeparateApprover(request.requestedById, actor.id)) {
    throw new Error("Le demandeur ne peut pas approuver sa propre demande d'annulation.");
  }

  const invoice = request.invoice;
  const paidAmount = sumFcfa(
    invoice.payments.filter((p) => p.status === "recorded").map((p) => p.amount),
  );

  // Cancel the invoice and its recorded payments (history/snapshots preserved).
  await updateInvoiceStatus(ctx.hospitalId, invoice.id, "cancelled");
  for (const payment of invoice.payments) {
    if (payment.status === "recorded") {
      await updatePaymentStatus(ctx.hospitalId, payment.id, "cancelled");
    }
  }
  await updateCancellationDecision(ctx.hospitalId, requestId, {
    status: "approved",
    decidedById: actor.id,
    decisionReason: decisionReason?.trim() || null,
    decidedAt: new Date(),
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.invoiceCancellationApproved,
    entityType: "Invoice",
    entityId: invoice.id,
    summary: `Annulation approuvée — facture ${invoice.invoiceNumber} (${formatFcfa(invoice.totalAmount)})`,
  });

  // Generate a refund voucher only when money was actually collected.
  if (paidAmount > 0) {
    const year = new Date().getFullYear();
    const voucherNumber = await generateNumber(ctx, "refund_voucher", year);
    const voucher = await createRefundVoucher({
      hospitalId: ctx.hospitalId,
      voucherNumber,
      invoiceId: invoice.id,
      cancellationRequestId: requestId,
      amount: paidAmount,
      reason: request.reason,
      requestedById: request.requestedById,
    });
    await recordAudit({
      hospitalId: ctx.hospitalId,
      actorId: actor.id,
      action: AUDIT_ACTIONS.refundVoucherCreated,
      entityType: "RefundVoucher",
      entityId: voucher.id,
      summary: `Bon de remboursement ${voucher.voucherNumber} créé (${formatFcfa(paidAmount)}) — facture ${invoice.invoiceNumber}`,
    });
  }

  return findCancellationRequestById(ctx.hospitalId, requestId);
}

/** Administrator rejects a cancellation request (mandatory decision reason). No invoice change. */
export async function rejectInvoiceCancellation(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  requestId: string,
  decisionReason: string,
) {
  await requireCapability(actor, ctx, "invoice.cancel.approve", {
    type: "InvoiceCancellationRequest",
    id: requestId,
  });

  const request = await findCancellationRequestById(ctx.hospitalId, requestId);
  if (!request) throw new Error("Demande d'annulation introuvable dans cet hôpital.");
  if (!canDecideCancellation(request.status)) {
    throw new Error("Cette demande a déjà été traitée.");
  }
  if (!isSeparateApprover(request.requestedById, actor.id)) {
    throw new Error("Le demandeur ne peut pas décider de sa propre demande d'annulation.");
  }
  if (!isValidCancellationReason(decisionReason)) {
    throw new Error("Le motif de rejet est obligatoire.");
  }

  await updateCancellationDecision(ctx.hospitalId, requestId, {
    status: "rejected",
    decidedById: actor.id,
    decisionReason: decisionReason.trim(),
    decidedAt: new Date(),
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.invoiceCancellationRejected,
    entityType: "Invoice",
    entityId: request.invoiceId,
    summary: `Demande d'annulation rejetée — facture ${request.invoice.invoiceNumber} — motif : ${decisionReason.trim()}`,
  });
  return findCancellationRequestById(ctx.hospitalId, requestId);
}
