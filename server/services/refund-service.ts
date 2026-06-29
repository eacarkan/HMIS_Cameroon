import { canTransitionRefund } from "@/lib/refund-voucher";
import { formatFcfa } from "@/lib/money";
import {
  findRefundVoucherById,
  listRefundVouchers as listRefundVouchersDb,
  updateRefundVoucher,
  type HospitalContext,
} from "@/server/db";
import type { RefundVoucherStatus } from "@prisma/client";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Phase 2C — refund voucher ("bon d'avoir") lifecycle: requested → approved → paid (+ cancelled).
 * The Hospital Administrator approves/cancels; the cashier executes (records the physical cash-out).
 * Transitions are guarded by the pure state machine in `lib/refund-voucher`. Integer FCFA.
 */

export async function listRefunds(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  status?: RefundVoucherStatus,
) {
  await requireCapability(actor, ctx, "refund.read");
  return listRefundVouchersDb(ctx.hospitalId, status);
}

export async function getRefund(actor: AuthenticatedActor, ctx: HospitalContext, id: string) {
  await requireCapability(actor, ctx, "refund.read");
  return findRefundVoucherById(ctx.hospitalId, id);
}

async function loadVoucherForTransition(
  ctx: HospitalContext,
  id: string,
  to: RefundVoucherStatus,
) {
  const voucher = await findRefundVoucherById(ctx.hospitalId, id);
  if (!voucher) throw new Error("Bon de remboursement introuvable dans cet hôpital.");
  if (!canTransitionRefund(voucher.status, to)) {
    throw new Error(`Transition de bon de remboursement invalide : ${voucher.status} → ${to}.`);
  }
  return voucher;
}

/** Administrator approves a requested refund voucher (requested → approved). */
export async function approveRefund(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "invoice.cancel.approve", { type: "RefundVoucher", id });
  const voucher = await loadVoucherForTransition(ctx, id, "approved");
  await updateRefundVoucher(ctx.hospitalId, id, {
    status: "approved",
    approvedById: actor.id,
    approvedAt: new Date(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.refundVoucherApproved,
    entityType: "RefundVoucher",
    entityId: id,
    summary: `Bon de remboursement ${voucher.voucherNumber} approuvé (${formatFcfa(voucher.amount)})`,
  });
  return findRefundVoucherById(ctx.hospitalId, id);
}

/** Cashier executes an approved refund voucher — records the physical cash-out (approved → paid). */
export async function executeRefund(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "refund.execute", { type: "RefundVoucher", id });
  const voucher = await loadVoucherForTransition(ctx, id, "paid");
  await updateRefundVoucher(ctx.hospitalId, id, {
    status: "paid",
    executedById: actor.id,
    executedAt: new Date(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.refundVoucherExecuted,
    entityType: "RefundVoucher",
    entityId: id,
    summary: `Bon de remboursement ${voucher.voucherNumber} payé (${formatFcfa(voucher.amount)})`,
  });
  return findRefundVoucherById(ctx.hospitalId, id);
}

/** Administrator cancels a not-yet-paid refund voucher (requested/approved → cancelled). */
export async function cancelRefund(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  reason: string,
) {
  await requireCapability(actor, ctx, "invoice.cancel.approve", { type: "RefundVoucher", id });
  const voucher = await loadVoucherForTransition(ctx, id, "cancelled");
  if (reason.trim().length === 0) throw new Error("Le motif d'annulation est obligatoire.");
  await updateRefundVoucher(ctx.hospitalId, id, {
    status: "cancelled",
    cancelledById: actor.id,
    cancelledAt: new Date(),
  });
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.refundVoucherCancelled,
    entityType: "RefundVoucher",
    entityId: id,
    summary: `Bon de remboursement ${voucher.voucherNumber} annulé — motif : ${reason.trim()}`,
  });
  return findRefundVoucherById(ctx.hospitalId, id);
}
