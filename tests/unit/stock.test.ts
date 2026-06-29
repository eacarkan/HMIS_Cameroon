import { describe, expect, it } from "vitest";

import {
  availableToReserve,
  isExpired,
  sortFefo,
  totalOnHand,
  totalReserved,
  validateStockBatchInput,
} from "@/lib/stock";

const base = { medicationId: "med-1", batchNumber: "LOT-A", expiryDate: "2027-06-30", quantity: 100 };

describe("stock rules (Phase 2D-3)", () => {
  it("validates a complete batch input", () => {
    expect(validateStockBatchInput(base).ok).toBe(true);
  });

  it("requires medication, batch number, a valid expiry and a positive integer quantity", () => {
    expect(validateStockBatchInput({ ...base, medicationId: "" }).ok).toBe(false);
    expect(validateStockBatchInput({ ...base, batchNumber: " " }).ok).toBe(false);
    expect(validateStockBatchInput({ ...base, expiryDate: "not-a-date" }).ok).toBe(false);
    expect(validateStockBatchInput({ ...base, quantity: 0 }).ok).toBe(false);
    expect(validateStockBatchInput({ ...base, quantity: -5 }).ok).toBe(false);
    expect(validateStockBatchInput({ ...base, quantity: 2.5 }).ok).toBe(false);
  });

  it("orders batches FEFO (earliest expiry first; ties by createdAt)", () => {
    const batches = [
      { id: "c", expiryDate: "2027-06-30", createdAt: "2026-01-01" },
      { id: "a", expiryDate: "2026-12-31", createdAt: "2026-02-01" },
      { id: "b", expiryDate: "2026-12-31", createdAt: "2026-01-15" },
    ];
    expect(sortFefo(batches).map((b) => b.id)).toEqual(["b", "a", "c"]);
  });

  it("computes available-to-reserve, totals and expiry", () => {
    expect(availableToReserve({ quantityOnHand: 100, quantityReserved: 30 })).toBe(70);
    expect(availableToReserve({ quantityOnHand: 10, quantityReserved: 25 })).toBe(0); // never negative
    expect(totalOnHand([{ quantityOnHand: 100 }, { quantityOnHand: 50 }])).toBe(150);
    expect(totalReserved([{ quantityReserved: 5 }, { quantityReserved: 2 }])).toBe(7);
    const now = new Date("2026-06-30T00:00:00");
    expect(isExpired("2026-01-01", now)).toBe(true);
    expect(isExpired("2027-01-01", now)).toBe(false);
  });
});
