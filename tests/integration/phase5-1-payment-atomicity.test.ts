import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import { createInvoice, createPatientForActor, openEncounter, recordPayment } from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 5.1 (F-01) — payment atomicity. `recordPayment` now records the payment and updates the invoice
 * status inside ONE interactive transaction, under a `SELECT … FOR UPDATE` lock on the invoice, and
 * re-derives the remaining balance from the AUTHORITATIVE recorded payments inside the lock. These tests
 * prove: concurrent double-payment / overpayment is impossible, the invoice never over-collects, valid
 * concurrent partials still succeed, and the payment row + invoice status stay consistent. Synthetic only.
 */
const HRB = "hosp-hrb-demo";

/** A fresh HRB invoice of `total` FCFA on a synthetic encounter; returns {cashier, invoice}. */
async function invoiceOf(total: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "ATOMIC", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: total, quantity: 1 }]);
  return { cashier, invoice };
}

async function recordedTotal(invoiceId: string) {
  const agg = await prisma.payment.aggregate({ _sum: { amount: true }, where: { hospitalId: HRB, invoiceId, status: "recorded" } });
  return agg._sum.amount ?? 0;
}

describe("integration: Phase 5.1 payment atomicity (F-01)", () => {
  beforeEach(resetTestDb);

  it("prevents concurrent OVERPAYMENT — two full payments race, only one succeeds, invoice never over-collects", async () => {
    const { cashier, invoice } = await invoiceOf(3000);
    const results = await Promise.allSettled([
      recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 3000, method: "cash" }),
      recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 3000, method: "cash" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1); // exactly one payment recorded
    expect(failed).toBe(1); // the other is rejected under the lock
    expect(await recordedTotal(invoice.id)).toBe(3000); // NEVER over-collects
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("paid");
    expect(await prisma.payment.count({ where: { hospitalId: HRB, invoiceId: invoice.id, status: "recorded" } })).toBe(1);
  });

  it("serialises VALID concurrent partials — two half payments both succeed and total the invoice exactly", async () => {
    const { cashier, invoice } = await invoiceOf(3000);
    const results = await Promise.allSettled([
      recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 1500, method: "cash" }),
      recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 1500, method: "mobile_money" }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await recordedTotal(invoice.id)).toBe(3000);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("paid");
  });

  it("rejects an amount greater than the remaining balance; the payment row and invoice status stay consistent", async () => {
    const { cashier, invoice } = await invoiceOf(3000);
    const first = await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 2000, method: "cash" });
    expect(first.status).toBe("recorded");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("partially_paid");
    // Remaining is 1000 — a 2000 payment must be rejected (no overpayment).
    await expect(recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 2000, method: "cash" })).rejects.toThrow(/invalide|solde/i);
    expect(await recordedTotal(invoice.id)).toBe(2000);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("partially_paid");
  });

  it("golden path — a full payment marks the invoice paid with a single recorded payment + receipt number", async () => {
    const { cashier, invoice } = await invoiceOf(3000);
    const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 3000, method: "cash" });
    expect(payment.status).toBe("recorded");
    expect(payment.receiptNumber).toMatch(/HRB-DEMO-R-2026-/);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("paid");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "payment.record" } })).toBe(1);
  });
});
