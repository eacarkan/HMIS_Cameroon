/**
 * Pharmacy reporting rules (pure, client-safe) — Phase 2D-8.
 *
 * Read-only classification + aggregation helpers over the existing 2D stock/dispensing data. No data
 * access, no mutation. Thresholds are prototype constants (a per-medication reorder level would be a
 * later additive schema change).
 */

import { isExpired } from "./stock";

/** Available units at or below which a medication line is flagged "low stock". */
export const LOW_STOCK_THRESHOLD = 50;
/** A non-expired lot within this many days of its expiry is flagged "expiring soon". */
export const EXPIRY_SOON_DAYS = 90;

/** Whole days from `now` to `date` (negative once past). */
export function daysUntil(date: Date | string, now: Date): number {
  const ms = new Date(date).getTime() - now.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function isLowStock(available: number, threshold: number = LOW_STOCK_THRESHOLD): boolean {
  return available <= threshold;
}

export type ExpiryClass = "expired" | "expiring" | "ok";

/** Classify a lot's expiry: expired (on/before now), expiring (within `soonDays`), or ok. */
export function expiryStatus(
  expiryDate: Date | string,
  now: Date,
  soonDays: number = EXPIRY_SOON_DAYS,
): ExpiryClass {
  if (isExpired(expiryDate, now)) return "expired";
  return daysUntil(expiryDate, now) <= soonDays ? "expiring" : "ok";
}

/**
 * Aggregate dispensed quantities per medication from a flat list of dispensed lines (each line carries
 * its medication id/label and an integer quantity). Returns rows sorted by descending units, plus the
 * grand totals (distinct dispense records counted by the caller).
 */
export function aggregateDispensingByMedication(
  lines: { medicationId: string; nameFr: string; unit: string; quantity: number }[],
): { rows: { medicationId: string; nameFr: string; unit: string; units: number; lineCount: number }[]; totalUnits: number } {
  const byMed = new Map<string, { medicationId: string; nameFr: string; unit: string; units: number; lineCount: number }>();
  let totalUnits = 0;
  for (const l of lines) {
    const q = Math.max(0, Math.trunc(l.quantity));
    totalUnits += q;
    const row = byMed.get(l.medicationId) ?? {
      medicationId: l.medicationId,
      nameFr: l.nameFr,
      unit: l.unit,
      units: 0,
      lineCount: 0,
    };
    row.units += q;
    row.lineCount += 1;
    byMed.set(l.medicationId, row);
  }
  const rows = [...byMed.values()].sort((a, b) => b.units - a.units || a.nameFr.localeCompare(b.nameFr));
  return { rows, totalUnits };
}
