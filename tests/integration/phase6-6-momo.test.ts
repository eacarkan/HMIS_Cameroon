import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createInvoice,
  createPatientForActor,
  getMobileMoneyReport,
  openEncounter,
  recordPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 6.6 · Unit 2 — Mobile-Money operator/reference capture + per-operator report (DB-backed). The
 * operator/reference are an immutable snapshot set at payment time (mobile_money only), and the report is
 * a read-only per-operator aggregate whose totals reconcile exactly. Synthetic data only.
 */
async function momoPayment(amount: number, operator: string, reference: string) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "MOMO", givenName: "Probe", sex: "male",
    dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale", reason: "Bilan",
  });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [
    { label: "Consultation", unitAmount: amount, quantity: 1 },
  ]);
  const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
    amount, method: "mobile_money", mobileMoneyOperator: operator, mobileMoneyReference: reference,
  });
  return { cashier, invoice, payment };
}

describe("integration: Phase 6.6 Mobile Money capture + report", () => {
  beforeEach(resetTestDb);

  it("captures operator/reference for a mobile_money payment (immutable snapshot)", async () => {
    const { payment } = await momoPayment(5000, "MTN", "MM-REF-001");
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row.method).toBe("mobile_money");
    expect(row.mobileMoneyOperator).toBe("MTN");
    expect(row.mobileMoneyReference).toBe("MM-REF-001");
    expect(row.amount).toBe(5000);
    expect(row.status).toBe("recorded");
  });

  it("never stores operator/reference for a non-mobile_money payment (dropped by the service)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "CASH", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 2000, quantity: 1 }]);
    // Even if operator/reference are (wrongly) supplied for a cash payment, the service drops them.
    const payment = await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
      amount: 2000, method: "cash", mobileMoneyOperator: "MTN", mobileMoneyReference: "X",
    });
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(row.mobileMoneyOperator).toBeNull();
    expect(row.mobileMoneyReference).toBeNull();
  });

  it("aggregates the per-operator report and totals reconcile exactly", async () => {
    await momoPayment(5000, "MTN", "R1");
    await momoPayment(3000, "ORANGE", "R2");
    await momoPayment(2000, "MTN", "R3");

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const report = await getMobileMoneyReport(cashier.actor, cashier.ctx, {});
    expect(report.total).toBe(10000);
    expect(report.count).toBe(3);
    expect(report.byOperator.find((o) => o.operator === "MTN")).toMatchObject({ count: 2, total: 7000 });
    expect(report.byOperator.find((o) => o.operator === "ORANGE")).toMatchObject({ count: 1, total: 3000 });
    // Exact reconciliation: Σ per-operator totals == report total.
    expect(report.byOperator.reduce((s, o) => s + o.total, 0)).toBe(report.total);
  });

  it("denies the MoMo report to a role without the capability", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getMobileMoneyReport(doctor.actor, doctor.ctx, {})).rejects.toBeInstanceOf(AuthorizationError);
  });
});
