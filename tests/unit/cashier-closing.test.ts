import { describe, expect, it } from "vitest";

import { computeBrouillard } from "@/lib/cashier-closing";

const P = (amount: number, method: string, status = "recorded") => ({ amount, method, status });

describe("Brouillard de Caisse math (Phase 2C)", () => {
  it("splits cash vs mobile/card and computes the expected closing balance", () => {
    const totals = computeBrouillard(
      10_000,
      [P(5000, "cash"), P(3000, "cash"), P(2000, "mobile_money"), P(1000, "card")],
      [],
    );
    expect(totals.totalCashReceived).toBe(8000);
    expect(totals.totalMobileCardReceived).toBe(3000);
    expect(totals.totalCancellationsRefunds).toBe(0);
    // opening + cash received − refunds = 10000 + 8000 − 0
    expect(totals.expectedClosingBalance).toBe(18_000);
    expect(totals.receiptCount).toBe(4);
  });

  it("treats bank_transfer as mobile/card (non-cash)", () => {
    const totals = computeBrouillard(0, [P(7000, "bank_transfer")], []);
    expect(totals.totalCashReceived).toBe(0);
    expect(totals.totalMobileCardReceived).toBe(7000);
    expect(totals.expectedClosingBalance).toBe(0);
  });

  it("ignores non-recorded (cancelled) payments", () => {
    const totals = computeBrouillard(
      1000,
      [P(5000, "cash"), P(9000, "cash", "cancelled")],
      [],
    );
    expect(totals.totalCashReceived).toBe(5000);
    expect(totals.receiptCount).toBe(1);
    expect(totals.expectedClosingBalance).toBe(6000);
  });

  it("only EXECUTED (paid) refunds reduce the drawer", () => {
    const totals = computeBrouillard(
      2000,
      [P(10_000, "cash")],
      [{ amount: 3000, status: "paid" }, { amount: 4000, status: "approved" }],
    );
    expect(totals.totalCancellationsRefunds).toBe(3000); // the approved (not yet paid) one is excluded
    expect(totals.expectedClosingBalance).toBe(2000 + 10_000 - 3000);
  });

  it("ignores unknown payment methods", () => {
    const totals = computeBrouillard(0, [P(500, "voucher")], []);
    expect(totals.totalCashReceived).toBe(0);
    expect(totals.totalMobileCardReceived).toBe(0);
    expect(totals.receiptCount).toBe(0);
  });
});
