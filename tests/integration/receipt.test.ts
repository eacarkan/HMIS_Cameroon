import { beforeEach, describe, expect, it } from "vitest";

import { getReceipt, recordReceiptPrint } from "@/server/services";
import { resetTestDb, prisma } from "../helpers/db";
import { runGoldenPath } from "../helpers/golden";

describe("integration: receipt (06 §13, 09 §10)", () => {
  beforeEach(resetTestDb);

  it("receipt data is sourced from the invoice/payment and reconciles", async () => {
    const { cashier, payment } = await runGoldenPath();
    const receipt = await getReceipt(cashier.actor, cashier.ctx, payment.id);

    expect(receipt?.receiptNumber).toBe("HRB-DEMO-R-2026-000001");
    expect(receipt?.invoice.invoiceNumber).toBe("HRB-DEMO-F-2026-000001");
    expect(receipt?.invoice.encounter.patient.patientNumber).toBe(
      "HRB-DEMO-P-2026-000001",
    );

    const sumItems = receipt!.invoice.items.reduce(
      (s, i) => s + i.lineTotal,
      0,
    );
    expect(receipt!.amount).toBe(3000);
    expect(receipt!.invoice.totalAmount).toBe(3000);
    expect(sumItems).toBe(3000);
    // No independent recomputation — amount equals the invoice total.
    expect(receipt!.amount).toBe(receipt!.invoice.totalAmount);
  });

  it("printing sets printedAt and audits receipt.print", async () => {
    const { cashier, payment } = await runGoldenPath();
    expect(payment.printedAt).toBeNull();

    await recordReceiptPrint(cashier.actor, cashier.ctx, payment.id);

    const printed = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(printed?.printedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { action: "receipt.print" },
    });
    expect(audit?.summary).toContain("HRB-DEMO-R-2026-000001");
  });
});
