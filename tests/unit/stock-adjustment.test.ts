import { describe, expect, it } from "vitest";

import {
  adjustmentDelta,
  canDecideAdjustment,
  isStockReducingAdjustment,
  STOCK_ADJUSTMENT_TYPES,
  validateAdjustmentInput,
} from "@/lib/stock-adjustment";

describe("stock-adjustment rules (Phase 2D-7)", () => {
  it("knows which types REDUCE on-hand", () => {
    expect(isStockReducingAdjustment("increase")).toBe(false);
    expect(isStockReducingAdjustment("decrease")).toBe(true);
    expect(isStockReducingAdjustment("loss")).toBe(true);
    expect(isStockReducingAdjustment("expiry")).toBe(true);
  });

  it("signs the on-hand delta by type", () => {
    expect(adjustmentDelta("increase", 10)).toBe(10);
    expect(adjustmentDelta("decrease", 10)).toBe(-10);
    expect(adjustmentDelta("loss", 7)).toBe(-7);
    expect(adjustmentDelta("expiry", 5)).toBe(-5);
    expect(adjustmentDelta("increase", 3.9)).toBe(3); // truncated integer
  });

  it("validates type, positive integer quantity, and a mandatory reason", () => {
    expect(validateAdjustmentInput({ type: "loss", quantity: 5, reason: "casse" }).ok).toBe(true);
    expect(validateAdjustmentInput({ type: "nope", quantity: 5, reason: "x" }).ok).toBe(false);
    expect(validateAdjustmentInput({ type: "loss", quantity: 0, reason: "x" }).ok).toBe(false);
    expect(validateAdjustmentInput({ type: "loss", quantity: -2, reason: "x" }).ok).toBe(false);
    expect(validateAdjustmentInput({ type: "loss", quantity: 2.5, reason: "x" }).ok).toBe(false);
    expect(validateAdjustmentInput({ type: "loss", quantity: 5, reason: "   " }).ok).toBe(false);
  });

  it("only a requested adjustment can be decided", () => {
    expect(canDecideAdjustment("requested")).toBe(true);
    expect(canDecideAdjustment("approved")).toBe(false);
    expect(canDecideAdjustment("rejected")).toBe(false);
  });

  it("exposes exactly the four adjustment types", () => {
    expect([...STOCK_ADJUSTMENT_TYPES]).toEqual(["increase", "decrease", "loss", "expiry"]);
  });
});
