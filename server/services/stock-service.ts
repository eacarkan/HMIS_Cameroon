import { totalOnHand, totalReserved, validateStockBatchInput, type StockBatchInput } from "@/lib/stock";
import { formatDateFr } from "@/lib/dates";
import {
  createStockBatch,
  findMedicationById,
  listStockBatches as dbListStockBatches,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Medication stock service (Phase 2D-3). Pharmacy receives batches (mandatory batch number +
 * expiry); everyone with `stock.read` views the ledger. Integer quantities; hospital-scoped;
 * audited. Reservations (2D-4), dispensing-deduction (2D-5) and adjustments (2D-7) build on this.
 */

export async function listStock(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  medicationId?: string,
) {
  await requireCapability(actor, ctx, "stock.read");
  return dbListStockBatches(ctx.hospitalId, medicationId);
}

export type StockSummaryRow = {
  medicationId: string;
  code: string;
  nameFr: string;
  unit: string;
  totalOnHand: number;
  totalReserved: number;
  available: number;
  batchCount: number;
  earliestExpiry: Date | null;
};

/** Per-medication stock summary (on-hand / reserved / available + earliest expiry). */
export async function getStockSummary(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
): Promise<StockSummaryRow[]> {
  await requireCapability(actor, ctx, "stock.read");
  const batches = await dbListStockBatches(ctx.hospitalId);
  const byMed = new Map<string, typeof batches>();
  for (const b of batches) {
    const list = byMed.get(b.medicationId) ?? [];
    list.push(b);
    byMed.set(b.medicationId, list);
  }
  const rows: StockSummaryRow[] = [];
  for (const [medicationId, list] of byMed) {
    const med = list[0].medication;
    const onHand = totalOnHand(list);
    const reserved = totalReserved(list);
    const earliest = list
      .map((b) => new Date(b.expiryDate).getTime())
      .reduce((min, t) => Math.min(min, t), Infinity);
    rows.push({
      medicationId,
      code: med.code,
      nameFr: med.nameFr,
      unit: med.unit,
      totalOnHand: onHand,
      totalReserved: reserved,
      available: Math.max(0, onHand - reserved),
      batchCount: list.length,
      earliestExpiry: Number.isFinite(earliest) ? new Date(earliest) : null,
    });
  }
  rows.sort((a, b) => a.nameFr.localeCompare(b.nameFr));
  return rows;
}

export async function receiveStockBatch(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  input: StockBatchInput,
) {
  await requireCapability(actor, ctx, "stock.receive", { type: "MedicationStockBatch" });
  const check = validateStockBatchInput(input);
  if (!check.ok) throw new Error(check.error);
  const med = await findMedicationById(ctx.hospitalId, input.medicationId);
  if (!med || !med.isActive) {
    throw new Error("Médicament introuvable ou inactif dans cet hôpital.");
  }

  const expiry = new Date(input.expiryDate);
  const batch = await createStockBatch({
    hospitalId: ctx.hospitalId,
    medicationId: med.id,
    batchNumber: input.batchNumber.trim(),
    expiryDate: expiry,
    quantityReceived: input.quantity,
    quantityOnHand: input.quantity,
    receivedById: actor.id,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.stockBatchReceived,
    entityType: "MedicationStockBatch",
    entityId: batch.id,
    summary: `Réception de stock : ${med.nameFr} — lot ${batch.batchNumber}, ${input.quantity} ${med.unit}, péremption ${formatDateFr(expiry)}`,
  });
  return batch;
}
