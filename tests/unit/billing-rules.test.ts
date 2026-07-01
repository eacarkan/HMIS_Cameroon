import { describe, expect, it } from "vitest";

import { canVoidInvoice, totalsByMethod } from "@/lib/billing-rules";

describe("unit: billing void rules", () => {
  it("allows voiding any non-cancelled invoice", () => {
    for (const s of ["draft", "issued", "partially_paid", "paid"]) {
      expect(canVoidInvoice(s)).toBe(true);
    }
  });
  it("rejects voiding an already-cancelled invoice", () => {
    expect(canVoidInvoice("cancelled")).toBe(false);
  });
});

describe("unit: totals by payment mode", () => {
  const payments = [
    { amount: 2000, method: "cash", status: "recorded" },
    { amount: 1000, method: "cash", status: "recorded" },
    { amount: 5000, method: "mobile_money", status: "recorded" },
    { amount: 9999, method: "cash", status: "cancelled" }, // voided — excluded
  ];

  it("aggregates recorded payments by method in canonical order, excluding cancelled", () => {
    const { rows, total, count } = totalsByMethod(payments);
    expect(total).toBe(8000);
    expect(count).toBe(3);
    expect(rows).toEqual([
      { method: "cash", total: 3000, count: 2 },
      { method: "mobile_money", total: 5000, count: 1 },
    ]);
  });

  it("returns empty totals when there are no recorded payments", () => {
    const { rows, total, count } = totalsByMethod([
      { amount: 100, method: "cash", status: "cancelled" },
    ]);
    expect(rows).toEqual([]);
    expect(total).toBe(0);
    expect(count).toBe(0);
  });
});
