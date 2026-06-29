import {
  findPaymentById,
  markReceiptPrinted,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/** Receipt service (06 §13, 09 §10). The receipt is fed by billing data — it never
 * recomputes amounts. */

export async function getReceipt(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  paymentId: string,
) {
  await requireCapability(actor, ctx, "invoice.read");
  return findPaymentById(ctx.hospitalId, paymentId);
}

/** Mark the receipt printed and audit `receipt.print`. */
export async function recordReceiptPrint(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  paymentId: string,
) {
  await requireCapability(actor, ctx, "receipt.print");

  const payment = await findPaymentById(ctx.hospitalId, paymentId);
  if (!payment) throw new Error("Reçu introuvable dans cet hôpital.");

  // First print sets printedAt + audits `receipt.print`; any later print is a reprint
  // (audited `receipt.reprint`) and the document is marked as a duplicate (Batch 3).
  const isReprint = payment.printedAt != null;
  if (!isReprint) await markReceiptPrinted(ctx.hospitalId, paymentId);

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: isReprint ? AUDIT_ACTIONS.receiptReprint : AUDIT_ACTIONS.receiptPrint,
    entityType: "Payment",
    entityId: paymentId,
    summary: `${isReprint ? "Réimpression" : "Impression"} du reçu ${payment.receiptNumber}`,
  });

  return payment;
}
