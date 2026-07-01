import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  approveInvoiceCancellation,
  approveRefund,
  cancelRefund,
  createInvoice,
  createPatientForActor,
  executeRefund,
  getInvoice,
  openEncounter,
  recordPayment,
  requestInvoiceCancellation,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3F-1 — Financial transaction hardening (doc 34 §9). This suite VERIFIES the Phase 2
 * hardening originally delivered as H2 (commit 17a9fa1): atomic, status-guarded cancellation +
 * refund-voucher transitions, requester≠approver, no double-approval / double-refund,
 * cross-hospital denial, and audit only on a successful transition. It maps 1:1 to doc 34 §9.14.
 * No application logic is re-implemented here — these are the required behavioural assertions.
 * Synthetic data only.
 */
const LINES = [
  { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
  { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
];

async function paidInvoice() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: null,
    residence: null,
  });
  const encounter = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Fièvre",
  });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, encounter.id, LINES);
  await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: invoice.totalAmount, method: "cash" });
  return { cashier, invoice };
}

/** A cashier-requested cancellation, approved by the admin → returns the raised refund voucher. */
async function cancelledWithVoucher() {
  const { cashier, invoice } = await paidInvoice();
  await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Erreur de saisie");
  const admin = await loginAndSelect(ACCOUNTS.admin);
  const request = await prisma.invoiceCancellationRequest.findFirstOrThrow({ where: { invoiceId: invoice.id } });
  const decided = await approveInvoiceCancellation(admin.actor, admin.ctx, request.id);
  return { admin, cashier, invoice, voucher: decided!.refundVoucher! };
}

describe("integration: Phase 3F-1 financial transaction hardening (verifies H2)", () => {
  beforeEach(resetTestDb);

  it("cancellation approval is all-or-nothing: invoice cancelled + payments cancelled + voucher raised together", async () => {
    const { invoice, voucher } = await cancelledWithVoucher();
    const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
    expect(after.status).toBe("cancelled");
    // No recorded payment survives the cancellation; the voucher captures the collected amount.
    expect(after.payments.every((p) => p.status !== "recorded")).toBe(true);
    expect(voucher).not.toBeNull();
    expect(voucher.amount).toBe(invoice.totalAmount); // (7) financial totals remain consistent
    expect(voucher.status).toBe("requested");
  });

  it("a refund voucher cannot be executed twice (status-guarded)", async () => {
    const { admin, cashier, voucher } = await cancelledWithVoucher();
    await approveRefund(admin.actor, admin.ctx, voucher.id);
    await executeRefund(cashier.actor, cashier.ctx, voucher.id); // → paid
    const executedAudits = await prisma.auditLog.count({
      where: { action: "refund_voucher.executed", entityId: voucher.id },
    });
    await expect(executeRefund(cashier.actor, cashier.ctx, voucher.id)).rejects.toThrow();
    // (6) audit only on a successful transition: the failed second execute writes no new audit.
    expect(await prisma.auditLog.count({ where: { action: "refund_voucher.executed", entityId: voucher.id } })).toBe(
      executedAudits,
    );
  });

  it("a cancelled refund voucher cannot be approved", async () => {
    const { admin, voucher } = await cancelledWithVoucher();
    await cancelRefund(admin.actor, admin.ctx, voucher.id, "Annulation du bon");
    await expect(approveRefund(admin.actor, admin.ctx, voucher.id)).rejects.toThrow();
  });

  it("cross-hospital refund execution is blocked (per-hospital RBAC)", async () => {
    const { cashier, voucher } = await cancelledWithVoucher();
    // A context for a hospital the cashier is NOT a member of is denied before any voucher lookup.
    await expect(
      executeRefund(cashier.actor, { ...cashier.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" }, voucher.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the cashier cannot approve a cancellation (cashier ≠ approver)", async () => {
    const { cashier, invoice } = await paidInvoice();
    await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Erreur");
    const request = await prisma.invoiceCancellationRequest.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    // The cashier lacks invoice.cancel.approve entirely.
    await expect(approveInvoiceCancellation(cashier.actor, cashier.ctx, request.id)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a user holding BOTH request + approve cannot approve their OWN request (requester ≠ approver)", async () => {
    const { invoice } = await paidInvoice();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    // A crafted actor (real user id, for audit FK) holding caissier + administrateur AT this hospital.
    const dual = {
      ...admin.actor,
      roles: ["caissier", "administrateur"],
      rolesByHospital: { [admin.ctx.hospitalId]: ["caissier", "administrateur"] },
    };
    await requestInvoiceCancellation(dual, admin.ctx, invoice.id, "Erreur"); // requestedById = admin.actor.id
    const request = await prisma.invoiceCancellationRequest.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await expect(approveInvoiceCancellation(dual, admin.ctx, request.id)).rejects.toThrow(/demandeur/i);
    // The invoice is untouched (still not cancelled) — the guard fired before any state change.
    expect((await getInvoice(admin.actor, admin.ctx, invoice.id))!.status).not.toBe("cancelled");
  });
});
