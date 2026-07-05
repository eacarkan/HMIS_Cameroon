import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createInvoice,
  createPatientForActor,
  generateRevenueStatementNumber,
  getRevenueStatement,
  openEncounter,
  recordPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 6.6 · Unit 5 — "État mensuel numéroté des recettes" (DB-backed). An internal read-only revenue
 * aggregate whose total reconciles with the recorded payments; numbering is a separate deterministic +
 * audited act that writes NO invoice/payment money field. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

async function paidInvoice(amount: number, method: "cash" | "mobile_money") {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "ETAT", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: amount, quantity: 1 }]);
  await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount, method });
}

async function moneySnapshot() {
  const invoices = await prisma.invoice.findMany({ orderBy: { id: "asc" }, select: { id: true, totalAmount: true, status: true, invoiceNumber: true } });
  const payments = await prisma.payment.findMany({ orderBy: { id: "asc" }, select: { id: true, amount: true, status: true, receiptNumber: true, method: true } });
  return { invoices, payments };
}

describe("integration: Phase 6.6 numbered monthly revenue statement", () => {
  beforeEach(resetTestDb);

  it("aggregates recorded payments by method and the total reconciles", async () => {
    await paidInvoice(5000, "cash");
    await paidInvoice(3000, "mobile_money");
    await paidInvoice(2000, "cash");

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const st = await getRevenueStatement(cashier.actor, cashier.ctx);
    expect(st.total).toBe(10000);
    expect(st.paymentCount).toBe(3);
    expect(st.byMethod.find((m) => m.method === "cash")).toMatchObject({ count: 2, total: 7000 });
    expect(st.byMethod.find((m) => m.method === "mobile_money")).toMatchObject({ count: 1, total: 3000 });
    expect(st.byMethod.reduce((s, m) => s + m.total, 0)).toBe(st.total);
    expect(st.invoiceCount).toBeGreaterThanOrEqual(3);
  });

  it("assigns a deterministic ETAT number and audits generation", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const g1 = await generateRevenueStatementNumber(cashier.actor, cashier.ctx);
    expect(g1.number).toMatch(/^HRB-DEMO-ETAT-\d{4}-000001$/);
    const g2 = await generateRevenueStatementNumber(cashier.actor, cashier.ctx);
    expect(g2.number).toMatch(/^HRB-DEMO-ETAT-\d{4}-000002$/);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "revenue_statement.generated" } })).toBe(2);
  });

  it("generating a statement number mutates NO invoice/payment money field", async () => {
    await paidInvoice(4000, "cash");
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const before = await moneySnapshot();
    await generateRevenueStatementNumber(cashier.actor, cashier.ctx);
    expect(await moneySnapshot()).toEqual(before);
  });

  it("reports total invoiced, collected, net and arrears movement (facturé − encaissé)", async () => {
    await paidInvoice(5000, "cash"); // billed 5000, collected 5000
    // a partially-paid invoice: billed 4000, collected 1000
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "ARR", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const inv = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 4000, quantity: 1 }]);
    await recordPayment(cashier.actor, cashier.ctx, inv.id, { amount: 1000, method: "cash" });

    const st = await getRevenueStatement(cashier.actor, cashier.ctx);
    expect(st.totalInvoiced).toBe(9000); // 5000 + 4000 billed
    expect(st.total).toBe(6000); // 5000 + 1000 collected
    expect(st.refundsTotal).toBe(0);
    expect(st.netCollected).toBe(6000);
    expect(st.arrearsMovement).toBe(3000); // 9000 invoiced − 6000 collected
    // byMethod reconciles to total collected.
    expect(st.byMethod.reduce((s, m) => s + m.total, 0)).toBe(st.total);
  });

  it("includes executed refunds in refundsTotal and net collected", async () => {
    await paidInvoice(5000, "cash");
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const inv = await prisma.invoice.findFirstOrThrow({ where: { hospitalId: HRB } });
    const cr = await prisma.invoiceCancellationRequest.create({
      data: { hospitalId: HRB, invoiceId: inv.id, status: "approved", reason: "synthétique", requestedById: cashier.actor.id },
    });
    await prisma.refundVoucher.create({
      data: {
        hospitalId: HRB, voucherNumber: "HRB-DEMO-A-2026-000001", invoiceId: inv.id, cancellationRequestId: cr.id,
        amount: 2000, status: "paid", reason: "synthétique", requestedById: cashier.actor.id, executedAt: new Date(),
      },
    });
    const st = await getRevenueStatement(cashier.actor, cashier.ctx);
    expect(st.refundsTotal).toBe(2000);
    expect(st.netCollected).toBe(st.total - 2000);
  });

  it("statement wording is audit-trace + synthetic only (no certificate/attestation language)", async () => {
    const fr = (await import("@/messages/fr.json")).default;
    const s = JSON.stringify(fr.finance.statement);
    expect(s).not.toMatch(/certif|attestation/i);
    expect(fr.finance.statement.footerNote).toMatch(/journal d.audit/i);
    expect(fr.finance.statement.footerNote).toMatch(/synth[ée]tiques/i);
  });

  it("denies the statement to a role without revenue_statement.read", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getRevenueStatement(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
