import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmMockPayment,
  createInvoice,
  createMockPaymentIntent,
  createPatientForActor,
  createPaymentProviderForActor,
  getExternalPaymentAdmin,
  openEncounter,
  reconcileExternalPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 4D — payment provider abstraction (DB-backed). THE GUARANTEE: a mock confirmation NEVER marks
 * an invoice paid or rewrites history; only RECONCILIATION records a controlled Payment through the
 * EXISTING billing rule (invoice snapshots preserved). Also: mock-only (no network); unique reference;
 * finance-gated; hospital-scoped; audited. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

async function invoiceOf(amount: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "PAIE", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: amount, quantity: 1 }]);
  return { cashier, invoice };
}

describe("integration: Phase 4D external payment provider", () => {
  beforeEach(resetTestDb);
  afterEach(() => vi.restoreAllMocks());

  it("a mock CONFIRMATION never marks the invoice paid; only RECONCILE records a controlled payment", async () => {
    const { cashier, invoice } = await invoiceOf(2000);
    const provider = await createPaymentProviderForActor(cashier.actor, cashier.ctx, { code: "MTN_MOMO", name: "MTN", channel: "MOBILE_MONEY" });
    const txn = await createMockPaymentIntent(cashier.actor, cashier.ctx, {
      providerId: provider.id, amount: 2000, externalReference: "PAY-1", invoiceId: invoice.id,
    });

    // Confirm — the mock provider confirms, but the INVOICE is UNTOUCHED (no payment, not paid).
    await confirmMockPayment(cashier.actor, cashier.ctx, txn.id);
    expect((await prisma.externalPaymentTransaction.findUniqueOrThrow({ where: { id: txn.id } })).status).toBe("CONFIRMED");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).not.toBe("paid");
    expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(0);

    // Reconcile — records a CONTROLLED payment via the existing billing rule → invoice paid, snapshot intact.
    const itemsBefore = await prisma.invoiceItem.count({ where: { invoiceId: invoice.id } });
    await reconcileExternalPayment(cashier.actor, cashier.ctx, txn.id);
    const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(paid.status).toBe("paid");
    const payments = await prisma.payment.findMany({ where: { invoiceId: invoice.id } });
    expect(payments.length).toBe(1);
    expect(payments[0].method).toBe("mobile_money");
    expect((await prisma.externalPaymentTransaction.findUniqueOrThrow({ where: { id: txn.id } })).reconciledPaymentId).toBe(payments[0].id);
    expect(await prisma.invoiceItem.count({ where: { invoiceId: invoice.id } })).toBe(itemsBefore); // snapshot preserved
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "external_payment.reconciled" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "payment.record" } })).toBe(1); // the controlled path
  });

  it("reconciliation is guarded: cannot reconcile twice, nor a non-confirmed transaction", async () => {
    const { cashier, invoice } = await invoiceOf(2000);
    const provider = await createPaymentProviderForActor(cashier.actor, cashier.ctx, { code: "MTN", name: "MTN", channel: "MOBILE_MONEY" });
    const txn = await createMockPaymentIntent(cashier.actor, cashier.ctx, { providerId: provider.id, amount: 2000, externalReference: "PAY-2", invoiceId: invoice.id });
    // Cannot reconcile a PENDING transaction.
    await expect(reconcileExternalPayment(cashier.actor, cashier.ctx, txn.id)).rejects.toThrow(/CONFIRMÉE/i);
    await confirmMockPayment(cashier.actor, cashier.ctx, txn.id);
    await reconcileExternalPayment(cashier.actor, cashier.ctx, txn.id);
    // Cannot reconcile again.
    await expect(reconcileExternalPayment(cashier.actor, cashier.ctx, txn.id)).rejects.toThrow(/rapproch/i);
  });

  it("a duplicate reference is rejected (idempotent), and a mock confirm makes NO network request", async () => {
    const { cashier, invoice } = await invoiceOf(1000);
    const provider = await createPaymentProviderForActor(cashier.actor, cashier.ctx, { code: "OM", name: "Orange Money", channel: "MOBILE_MONEY" });
    await createMockPaymentIntent(cashier.actor, cashier.ctx, { providerId: provider.id, amount: 1000, externalReference: "DUP-1", invoiceId: invoice.id });
    await expect(
      createMockPaymentIntent(cashier.actor, cashier.ctx, { providerId: provider.id, amount: 1000, externalReference: "DUP-1" }),
    ).rejects.toThrow(/existe déjà/i);
    // Network-egress guard: confirming the mock payment performs no real HTTP request.
    const txn = await prisma.externalPaymentTransaction.findFirstOrThrow({ where: { hospitalId: HRB } });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((() => { throw new Error("NETWORK BLOCKED"); }) as unknown as typeof fetch);
    await confirmMockPayment(cashier.actor, cashier.ctx, txn.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a non-finance role is denied, and cross-hospital is denied", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getExternalPaymentAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(
      createPaymentProviderForActor(cashier.actor, { ...cashier.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" }, { code: "X", name: "x", channel: "c" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
