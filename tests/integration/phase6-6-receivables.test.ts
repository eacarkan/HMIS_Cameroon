import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createInvoice,
  createPatientForActor,
  getReceivablesAging,
  openEncounter,
  recordPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 6.6 · Unit 3 — receivables aging (DB-backed). Read-only, hospital-scoped: outstanding invoices +
 * outstanding emergency debts, bucketed by age, with totals that reconcile EXACTLY. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

async function agedInvoice(amount: number, daysAgo: number, pay: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "DETTE", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: amount, quantity: 1 }]);
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { createdAt: when } });
  if (pay > 0) await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: pay, method: "cash" });
  return { invoice, patient, enc };
}

describe("integration: Phase 6.6 receivables aging", () => {
  beforeEach(resetTestDb);

  it("buckets outstanding invoices by age and reconciles exactly", async () => {
    await agedInvoice(5000, 10, 0); // 0-30 → outstanding 5000
    await agedInvoice(4000, 45, 1000); // 31-60 → outstanding 3000 (partially paid)
    await agedInvoice(6000, 100, 0); // 90+ → outstanding 6000
    // A fully-paid invoice must NOT appear (0 outstanding, status paid).
    await agedInvoice(2000, 5, 2000);

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const aging = await getReceivablesAging(cashier.actor, cashier.ctx);

    expect(aging.reconciles).toBe(true);
    expect(aging.total).toBe(14000);
    expect(aging.invoicesOutstanding).toBe(14000);
    const byBucket = Object.fromEntries(aging.buckets.map((b) => [b.bucket, b.total]));
    expect(byBucket["0-30"]).toBe(5000);
    expect(byBucket["31-60"]).toBe(3000);
    expect(byBucket["61-90"]).toBe(0);
    expect(byBucket["90+"]).toBe(6000);
    // Σ buckets == total (exact reconciliation).
    expect(aging.buckets.reduce((s, b) => s + b.total, 0)).toBe(aging.total);
    // The paid invoice is excluded from the detail.
    expect(aging.detail.every((d) => d.outstanding > 0)).toBe(true);
    expect(aging.detail.length).toBe(3);
  });

  it("includes outstanding emergency debts and buckets them by age", async () => {
    const { patient, enc } = await agedInvoice(1000, 2, 1000); // paid → contributes nothing
    const when = new Date();
    when.setDate(when.getDate() - 75);
    await prisma.emergencyDebt.create({
      data: {
        hospitalId: HRB, encounterId: enc.id, patientId: patient.id,
        amount: 8000, source: "Soins d'urgence", status: "outstanding", createdAt: when,
      },
    });

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const aging = await getReceivablesAging(cashier.actor, cashier.ctx);
    expect(aging.emergencyOutstanding).toBe(8000);
    expect(aging.buckets.find((b) => b.bucket === "61-90")?.debtAmount).toBe(8000);
    expect(aging.total).toBe(8000);
    expect(aging.reconciles).toBe(true);
  });

  it("denies aging to a role without receivables.view", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getReceivablesAging(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
