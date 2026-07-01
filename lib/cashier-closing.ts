/**
 * Brouillard de Caisse math (pure, client-safe) — Phase 2C.
 *
 * Computes the five mandatory closing totals deterministically (integer FCFA), so a closed shift
 * can freeze reproducible figures. No data access; the caller supplies the cashier's recorded
 * payments and any executed refunds for the shift window.
 *
 * Drawer model (UAT): only CASH touches the physical drawer. Mobile/card receipts are tracked
 * separately and do not change the expected cash balance. Refund vouchers are assumed paid out of
 * the cash drawer, so they reduce the expected closing balance.
 */

export type BrouillardPayment = { amount: number; method: string; status: string };
export type BrouillardRefund = { amount: number; status: string };

export type BrouillardTotals = {
  totalCashReceived: number;
  totalMobileCardReceived: number;
  totalCancellationsRefunds: number;
  expectedClosingBalance: number;
  receiptCount: number;
};

const MOBILE_CARD_METHODS = new Set(["mobile_money", "card", "bank_transfer"]);

/**
 * The five Brouillard totals:
 * - `totalCashReceived` — recorded `cash` payments.
 * - `totalMobileCardReceived` — recorded mobile_money + card + bank_transfer.
 * - `totalCancellationsRefunds` — EXECUTED (status `paid`) refund vouchers.
 * - `expectedClosingBalance` = openingBalance + cash received − cancellations/refunds.
 * - `receiptCount` — number of recorded payments.
 */
export function computeBrouillard(
  openingBalance: number,
  payments: readonly BrouillardPayment[],
  refunds: readonly BrouillardRefund[],
): BrouillardTotals {
  let totalCashReceived = 0;
  let totalMobileCardReceived = 0;
  let receiptCount = 0;
  for (const p of payments) {
    if (p.status !== "recorded") continue;
    if (p.method === "cash") {
      totalCashReceived += p.amount;
      receiptCount += 1;
    } else if (MOBILE_CARD_METHODS.has(p.method)) {
      totalMobileCardReceived += p.amount;
      receiptCount += 1;
    }
  }
  let totalCancellationsRefunds = 0;
  for (const r of refunds) {
    if (r.status !== "paid") continue; // only EXECUTED refunds affect the drawer
    totalCancellationsRefunds += r.amount;
  }
  const expectedClosingBalance =
    openingBalance + totalCashReceived - totalCancellationsRefunds;
  return {
    totalCashReceived,
    totalMobileCardReceived,
    totalCancellationsRefunds,
    expectedClosingBalance,
    receiptCount,
  };
}
