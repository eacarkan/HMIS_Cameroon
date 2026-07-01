import {
  countDispenseRecordsSince,
  listDispenseItemsSince,
  listStockBatches,
  type HospitalContext,
} from "@/server/db";
import {
  aggregateDispensingByMedication,
  daysUntil,
  EXPIRY_SOON_DAYS,
  expiryStatus,
  isLowStock,
  LOW_STOCK_THRESHOLD,
  type ExpiryClass,
} from "@/lib/pharmacy-report";
import { totalOnHand, totalReserved } from "@/lib/stock";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";

/**
 * Pharmacy reporting service (Phase 2D-8). READ-ONLY aggregations over the existing 2D stock +
 * dispensing data: per-medication stock levels, low-stock lines, expiring/expired lots, and dispensing
 * volume over a window. No patient identifiers, no mutations. Gated on `stock.read` (pharmacy + oversight).
 */

export type StockLevelRow = {
  medicationId: string;
  code: string;
  nameFr: string;
  unit: string;
  totalOnHand: number;
  totalReserved: number;
  available: number;
  batchCount: number;
  earliestExpiry: Date | null;
  low: boolean;
};

export type ExpiringLotRow = {
  batchId: string;
  batchNumber: string;
  medicationNameFr: string;
  unit: string;
  expiryDate: Date;
  quantityOnHand: number;
  daysToExpiry: number;
  status: ExpiryClass;
};

export type PharmacyReport = {
  generatedAt: Date;
  windowDays: number;
  lowStockThreshold: number;
  expirySoonDays: number;
  stockLevels: StockLevelRow[];
  lowStock: StockLevelRow[];
  expiringLots: ExpiringLotRow[];
  dispensing: {
    recordCount: number;
    totalUnits: number;
    byMedication: { medicationId: string; nameFr: string; unit: string; units: number; lineCount: number }[];
  };
};

export async function getPharmacyReport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { now?: Date; windowDays?: number } = {},
): Promise<PharmacyReport> {
  await requireCapability(actor, ctx, "stock.read");
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? 30;
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const batches = await listStockBatches(ctx.hospitalId);

  // Per-medication stock levels.
  const byMed = new Map<string, typeof batches>();
  for (const b of batches) {
    const list = byMed.get(b.medicationId) ?? [];
    list.push(b);
    byMed.set(b.medicationId, list);
  }
  const stockLevels: StockLevelRow[] = [];
  for (const [medicationId, list] of byMed) {
    const med = list[0].medication;
    const onHand = totalOnHand(list);
    const reserved = totalReserved(list);
    const available = Math.max(0, onHand - reserved);
    const earliest = list
      .map((b) => new Date(b.expiryDate).getTime())
      .reduce((min, t) => Math.min(min, t), Infinity);
    stockLevels.push({
      medicationId,
      code: med.code,
      nameFr: med.nameFr,
      unit: med.unit,
      totalOnHand: onHand,
      totalReserved: reserved,
      available,
      batchCount: list.length,
      earliestExpiry: Number.isFinite(earliest) ? new Date(earliest) : null,
      low: isLowStock(available),
    });
  }
  stockLevels.sort((a, b) => a.nameFr.localeCompare(b.nameFr));
  const lowStock = stockLevels.filter((r) => r.low);

  // Expiring / expired lots that still hold physical stock.
  const expiringLots: ExpiringLotRow[] = batches
    .filter((b) => b.quantityOnHand > 0 && expiryStatus(b.expiryDate, now) !== "ok")
    .map((b) => ({
      batchId: b.id,
      batchNumber: b.batchNumber,
      medicationNameFr: b.medication.nameFr,
      unit: b.medication.unit,
      expiryDate: new Date(b.expiryDate),
      quantityOnHand: b.quantityOnHand,
      daysToExpiry: daysUntil(b.expiryDate, now),
      status: expiryStatus(b.expiryDate, now),
    }))
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

  // Dispensing volume over the window.
  const items = await listDispenseItemsSince(ctx.hospitalId, since);
  const recordCount = await countDispenseRecordsSince(ctx.hospitalId, since);
  const { rows, totalUnits } = aggregateDispensingByMedication(
    items.map((it) => ({
      medicationId: it.batch.medicationId,
      nameFr: it.batch.medication.nameFr,
      unit: it.unit,
      quantity: it.quantity,
    })),
  );

  return {
    generatedAt: now,
    windowDays,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    expirySoonDays: EXPIRY_SOON_DAYS,
    stockLevels,
    lowStock,
    expiringLots,
    dispensing: { recordCount, totalUnits, byMedication: rows },
  };
}
