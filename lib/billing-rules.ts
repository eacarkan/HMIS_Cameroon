/**
 * Billing / cashier financial-integrity rules (pure, client-safe) — Phase 1A Batch 3.
 *
 * Voiding rules and payment-mode aggregation, used for invoice cancellation and cashier
 * shift closing. No data access; no external payment/accounting integration. Integer FCFA.
 * InvoiceItem snapshots are never touched here — voiding is a state change, not a rewrite.
 */

export type InvoiceStatus = "draft" | "issued" | "partially_paid" | "paid" | "cancelled";
export type PaymentMethodCode = "cash" | "mobile_money" | "card" | "bank_transfer";

export const PAYMENT_METHODS: readonly PaymentMethodCode[] = [
  "cash",
  "mobile_money",
  "card",
  "bank_transfer",
] as const;

/** An invoice can be voided unless it is already cancelled. */
export function canVoidInvoice(status: string): boolean {
  return status !== "cancelled";
}

export type MethodTotal = {
  method: PaymentMethodCode;
  total: number; // integer FCFA
  count: number;
};

/**
 * Aggregate RECORDED payments by payment mode (cancelled/voided payments are excluded by
 * the caller's query, but we also guard on status here). Returns one row per method that
 * has at least one payment, in canonical method order, plus the grand total.
 */
export function totalsByMethod(
  payments: readonly { amount: number; method: string; status: string }[],
): { rows: MethodTotal[]; total: number; count: number } {
  const acc = new Map<PaymentMethodCode, { total: number; count: number }>();
  let total = 0;
  let count = 0;
  for (const p of payments) {
    if (p.status !== "recorded") continue;
    const method = p.method as PaymentMethodCode;
    if (!PAYMENT_METHODS.includes(method)) continue;
    const cur = acc.get(method) ?? { total: 0, count: 0 };
    cur.total += p.amount;
    cur.count += 1;
    acc.set(method, cur);
    total += p.amount;
    count += 1;
  }
  const rows: MethodTotal[] = PAYMENT_METHODS.filter((m) => acc.has(m)).map((m) => ({
    method: m,
    total: acc.get(m)!.total,
    count: acc.get(m)!.count,
  }));
  return { rows, total, count };
}
