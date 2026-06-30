import { describe, expect, it } from "vitest";

import {
  aggregateDispensingByMedication,
  daysUntil,
  expiryStatus,
  isLowStock,
} from "@/lib/pharmacy-report";

const now = new Date("2026-06-30");

describe("pharmacy reporting rules (Phase 2D-8)", () => {
  it("daysUntil counts whole days, negative once past", () => {
    expect(daysUntil("2026-07-30", now)).toBe(30);
    expect(daysUntil("2026-06-30", now)).toBe(0);
    expect(daysUntil("2026-05-31", now)).toBe(-30);
  });

  it("isLowStock uses the threshold (inclusive)", () => {
    expect(isLowStock(50)).toBe(true); // default threshold 50, inclusive
    expect(isLowStock(51)).toBe(false);
    expect(isLowStock(10, 5)).toBe(false);
    expect(isLowStock(5, 5)).toBe(true);
  });

  it("classifies expiry as expired / expiring / ok", () => {
    expect(expiryStatus("2026-01-01", now)).toBe("expired"); // before now
    expect(expiryStatus("2026-06-30", now)).toBe("expired"); // on now (<=)
    expect(expiryStatus("2026-08-15", now)).toBe("expiring"); // 46 days <= 90
    expect(expiryStatus("2026-12-31", now)).toBe("ok"); // > 90 days
  });

  it("aggregates dispensed units per medication, sorted by descending units", () => {
    const { rows, totalUnits } = aggregateDispensingByMedication([
      { medicationId: "para", nameFr: "Paracétamol", unit: "comprimé", quantity: 10 },
      { medicationId: "amox", nameFr: "Amoxicilline", unit: "gélule", quantity: 30 },
      { medicationId: "para", nameFr: "Paracétamol", unit: "comprimé", quantity: 5 },
    ]);
    expect(totalUnits).toBe(45);
    expect(rows[0]).toMatchObject({ medicationId: "amox", units: 30, lineCount: 1 });
    expect(rows[1]).toMatchObject({ medicationId: "para", units: 15, lineCount: 2 });
  });
});
