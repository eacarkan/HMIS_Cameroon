import {
  approveStockAdjustmentTx,
  createStockAdjustment,
  findStockAdjustmentById,
  findStockBatchById,
  listStockAdjustments,
  rejectStockAdjustmentRow,
  type HospitalContext,
} from "@/server/db";
import { isSeparateApprover } from "@/lib/cancellation-rules";
import { availableToReserve } from "@/lib/stock";
import {
  canDecideAdjustment,
  isStockReducingAdjustment,
  validateAdjustmentInput,
  type StockAdjustmentTypeValue,
} from "@/lib/stock-adjustment";
import type { StockAdjustmentStatus } from "@prisma/client";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Stock-adjustment service (Phase 2D-7). A `pharmacien` REQUESTS an adjustment against a batch (count
 * correction / loss / expired-stock removal) with a mandatory reason; the `pharmacien_chef` APPROVES
 * (on-hand changes atomically) or REJECTS (no change). Dual validation — the requester may not decide
 * their own request. A reducing adjustment can never touch reserved units or drive on-hand negative.
 */

const ADJ_LABEL: Record<StockAdjustmentTypeValue, string> = {
  increase: "correction (+)",
  decrease: "correction (−)",
  loss: "perte/avarie",
  expiry: "retrait péremption",
};

export async function listStockAdjustmentsForActor(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  status?: StockAdjustmentStatus,
) {
  await requireCapability(actor, ctx, "stock.read");
  return listStockAdjustments(ctx.hospitalId, status);
}

export async function getStockAdjustment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "stock.read");
  return findStockAdjustmentById(ctx.hospitalId, id);
}

/** Pharmacist requests an adjustment against a batch (mandatory reason; positive integer magnitude). */
export async function requestStockAdjustment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: { batchId: string; type: StockAdjustmentTypeValue; quantity: number; reason: string },
) {
  await requireCapability(actor, ctx, "stock.adjustment.request", {
    type: "MedicationStockBatch",
    id: input.batchId,
  });

  const check = validateAdjustmentInput(input);
  if (!check.ok) throw new Error(check.error);

  const batch = await findStockBatchById(ctx.hospitalId, input.batchId);
  if (!batch) throw new Error("Lot introuvable dans cet hôpital.");

  // Reducing adjustments cannot exceed the AVAILABLE (on-hand − reserved) — reserved units are protected.
  if (isStockReducingAdjustment(input.type) && availableToReserve(batch) < input.quantity) {
    throw new Error(
      "Stock disponible insuffisant pour cet ajustement (les unités réservées sont protégées).",
    );
  }

  const adjustment = await createStockAdjustment({
    hospitalId: ctx.hospitalId,
    batchId: batch.id,
    medicationId: batch.medicationId,
    type: input.type,
    quantity: input.quantity,
    reason: input.reason.trim(),
    requestedById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.stockAdjustmentRequested,
    entityType: "StockAdjustment",
    entityId: adjustment.id,
    summary:
      `Ajustement demandé — ${batch.medication.nameFr} lot ${batch.batchNumber} : ` +
      `${ADJ_LABEL[input.type]} ${input.quantity} — motif : ${input.reason.trim()}`,
  });
  return adjustment;
}

/** Pharmacist-in-Charge approves an adjustment (applies the on-hand change). Requester ≠ approver. */
export async function approveStockAdjustment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  decisionReason?: string,
) {
  await requireCapability(actor, ctx, "stock.adjustment.approve", { type: "StockAdjustment", id });

  const adjustment = await findStockAdjustmentById(ctx.hospitalId, id);
  if (!adjustment) throw new Error("Ajustement introuvable dans cet hôpital.");
  if (!canDecideAdjustment(adjustment.status)) throw new Error("Cet ajustement a déjà été traité.");
  if (!isSeparateApprover(adjustment.requestedById, actor.id)) {
    throw new Error("Le demandeur ne peut pas approuver son propre ajustement.");
  }

  const approved = await approveStockAdjustmentTx({
    hospitalId: ctx.hospitalId,
    adjustmentId: adjustment.id,
    batchId: adjustment.batchId,
    type: adjustment.type,
    quantity: adjustment.quantity,
    decidedById: actor.id,
    decisionReason: decisionReason?.trim() || null,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.stockAdjustmentApproved,
    entityType: "StockAdjustment",
    entityId: adjustment.id,
    summary:
      `Ajustement approuvé — ${adjustment.medication.nameFr} lot ${adjustment.batch.batchNumber} : ` +
      `${ADJ_LABEL[adjustment.type as StockAdjustmentTypeValue]} ${adjustment.quantity}`,
  });
  return approved;
}

/** Pharmacist-in-Charge rejects an adjustment (mandatory decision reason; no stock change). */
export async function rejectStockAdjustment(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  decisionReason: string,
) {
  await requireCapability(actor, ctx, "stock.adjustment.approve", { type: "StockAdjustment", id });

  const adjustment = await findStockAdjustmentById(ctx.hospitalId, id);
  if (!adjustment) throw new Error("Ajustement introuvable dans cet hôpital.");
  if (!canDecideAdjustment(adjustment.status)) throw new Error("Cet ajustement a déjà été traité.");
  if (!isSeparateApprover(adjustment.requestedById, actor.id)) {
    throw new Error("Le demandeur ne peut pas décider de son propre ajustement.");
  }
  if (!decisionReason?.trim()) throw new Error("Le motif de rejet est obligatoire.");

  const rejected = await rejectStockAdjustmentRow({
    hospitalId: ctx.hospitalId,
    adjustmentId: adjustment.id,
    decidedById: actor.id,
    decisionReason: decisionReason.trim(),
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.stockAdjustmentRejected,
    entityType: "StockAdjustment",
    entityId: adjustment.id,
    summary:
      `Ajustement rejeté — ${adjustment.medication.nameFr} lot ${adjustment.batch.batchNumber} — ` +
      `motif : ${decisionReason.trim()}`,
  });
  return rejected;
}
