/**
 * Stock-adjustment rules (pure, client-safe) — Phase 2D-7.
 *
 * A pharmacist REQUESTS a stock adjustment (count correction, loss, or expired-stock removal); the
 * Pharmacist-in-Charge APPROVES (on-hand changes) or REJECTS. Dual validation = requester ≠ approver.
 * These helpers carry no data access. The signed on-hand delta is derived from the adjustment type.
 */

export const STOCK_ADJUSTMENT_TYPES = ["increase", "decrease", "loss", "expiry"] as const;
export type StockAdjustmentTypeValue = (typeof STOCK_ADJUSTMENT_TYPES)[number];

/** Every type except `increase` REMOVES units from on-hand. */
export function isStockReducingAdjustment(type: string): boolean {
  return type === "decrease" || type === "loss" || type === "expiry";
}

/** Signed on-hand delta: +quantity for `increase`, −quantity for decrease/loss/expiry. Integer. */
export function adjustmentDelta(type: StockAdjustmentTypeValue, quantity: number): number {
  const q = Math.max(0, Math.trunc(quantity));
  return type === "increase" ? q : -q;
}

export function validateAdjustmentInput(input: {
  type: string;
  quantity: number;
  reason: string;
}): { ok: boolean; error?: string } {
  if (!STOCK_ADJUSTMENT_TYPES.includes(input.type as StockAdjustmentTypeValue)) {
    return { ok: false, error: "Type d'ajustement invalide." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "La quantité doit être un entier positif." };
  }
  if (!input.reason?.trim()) {
    return { ok: false, error: "Le motif de l'ajustement est obligatoire." };
  }
  return { ok: true };
}

/** Only a `requested` adjustment can be approved or rejected. */
export function canDecideAdjustment(status: string): boolean {
  return status === "requested";
}
