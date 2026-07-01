import { describe, expect, it } from "vitest";

import {
  allocateFefo,
  availableToReserve,
  fefoBatchId,
  isExpired,
  sortFefo,
  totalOnHand,
  totalReserved,
  validateFefoOverride,
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

describe("FEFO allocation (Phase 2D-4/2D-5)", () => {
  const batches = [
    { id: "late", expiryDate: "2027-06-30", quantityOnHand: 500, quantityReserved: 0 },
    { id: "early", expiryDate: "2026-12-31", quantityOnHand: 200, quantityReserved: 0 },
  ];

  it("allocates from the earliest-expiry batch first", () => {
    const r = allocateFefo(batches, 15, availableToReserve);
    expect(r.allocations).toEqual([{ batchId: "early", quantity: 15 }]);
    expect(r.allocated).toBe(15);
    expect(r.shortfall).toBe(0);
  });

  it("spills over to the next batch when the first is exhausted", () => {
    const r = allocateFefo(batches, 250, availableToReserve);
    expect(r.allocations).toEqual([
      { batchId: "early", quantity: 200 },
      { batchId: "late", quantity: 50 },
    ]);
    expect(r.allocated).toBe(250);
    expect(r.shortfall).toBe(0);
  });

  it("reports a shortfall when total stock is insufficient", () => {
    const r = allocateFefo(batches, 800, availableToReserve);
    expect(r.allocated).toBe(700);
    expect(r.shortfall).toBe(100);
  });

  it("skips batches with no available-to-reserve", () => {
    const reserved = [
      { id: "early", expiryDate: "2026-12-31", quantityOnHand: 200, quantityReserved: 200 },
      { id: "late", expiryDate: "2027-06-30", quantityOnHand: 500, quantityReserved: 0 },
    ];
    const r = allocateFefo(reserved, 30, availableToReserve);
    expect(r.allocations).toEqual([{ batchId: "late", quantity: 30 }]);
  });
});

describe("FEFO override helpers (Phase 2D-6)", () => {
  const now = new Date("2026-06-30");
  const batches = [
    { id: "early", expiryDate: "2026-12-31", createdAt: "2026-01-01", quantityOnHand: 200, quantityReserved: 0 },
    { id: "late", expiryDate: "2027-06-30", createdAt: "2026-01-01", quantityOnHand: 500, quantityReserved: 0 },
    { id: "expired", expiryDate: "2026-01-01", createdAt: "2026-01-01", quantityOnHand: 100, quantityReserved: 0 },
  ];

  it("fefoBatchId picks the earliest-expiry NON-expired batch that can cover the quantity", () => {
    expect(fefoBatchId(batches, 50, now)).toBe("early");
  });

  it("fefoBatchId skips a batch without enough available-to-reserve", () => {
    const tight = [
      { id: "early", expiryDate: "2026-12-31", quantityOnHand: 10, quantityReserved: 8 }, // avail 2
      { id: "late", expiryDate: "2027-06-30", quantityOnHand: 500, quantityReserved: 0 },
    ];
    expect(fefoBatchId(tight, 50, now)).toBe("late");
  });

  it("fefoBatchId returns null when nothing qualifies", () => {
    const none = [{ id: "expired", expiryDate: "2026-01-01", quantityOnHand: 100, quantityReserved: 0 }];
    expect(fefoBatchId(none, 5, now)).toBeNull();
  });

  const target = { id: "late", medicationId: "med-1", expiryDate: "2027-06-30", quantityOnHand: 500, quantityReserved: 0 };
  const ok = { currentBatchId: "early", reason: "Lot prioritaire endommagé", quantity: 30, target, medicationId: "med-1", now };

  it("accepts a valid override to a later, stocked, same-medication batch", () => {
    expect(validateFefoOverride(ok)).toEqual({ ok: true });
  });

  it("requires a reason", () => {
    expect(validateFefoOverride({ ...ok, reason: "   " }).ok).toBe(false);
  });

  it("rejects choosing the already-reserved batch", () => {
    expect(validateFefoOverride({ ...ok, target: { ...target, id: "early" } }).ok).toBe(false);
  });

  it("rejects a different medication", () => {
    expect(validateFefoOverride({ ...ok, target: { ...target, medicationId: "med-2" } }).ok).toBe(false);
  });

  it("rejects an EXPIRED target (expired stock is the 2D-7 flow, never a FEFO override)", () => {
    expect(validateFefoOverride({ ...ok, target: { ...target, expiryDate: "2026-01-01" } }).ok).toBe(false);
  });

  it("rejects a target without enough available-to-reserve", () => {
    expect(
      validateFefoOverride({ ...ok, target: { ...target, quantityOnHand: 30, quantityReserved: 10 } }).ok,
    ).toBe(false);
  });
});
