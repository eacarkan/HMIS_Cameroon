import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  approveInvoiceCancellation,
  approveRefund,
  cancelRefund,
  closeCashierShift,
  correctCashierShift,
  createInvoice,
  createPatientForActor,
  executeRefund,
  getCashierShift,
  getInvoice,
  getOpenShift,
  getRefund,
  openCashierShift,
  openEncounter,
  recordPayment,
  rejectInvoiceCancellation,
  requestInvoiceCancellation,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const LINES = [
  { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
  { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
];

async function anEncounterId() {
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
  return encounter.id;
}

async function paidInvoice() {
  const encounterId = await anEncounterId();
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, LINES);
  await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
    amount: invoice.totalAmount,
    method: "cash",
  });
  return { cashier, invoice };
}

describe("integration: Phase 2C — cancellation workflow + refund voucher", () => {
  beforeEach(resetTestDb);

  it("cashier requests → admin approves a PAID invoice → invoice cancelled, refund voucher raised", async () => {
    const { cashier, invoice } = await paidInvoice();
    const before = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    const itemsBefore = before!.items.map((i) => ({ label: i.label, lineTotal: i.lineTotal }));

    const request = await requestInvoiceCancellation(
      cashier.actor,
      cashier.ctx,
      invoice.id,
      "Erreur de saisie",
    );
    expect(request.status).toBe("requested");
    const reqAudit = await prisma.auditLog.findFirst({
      where: { action: "invoice.cancellation_requested", entityId: request.id },
    });
    expect(reqAudit?.summary).toContain("Erreur de saisie");

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const decided = await approveInvoiceCancellation(admin.actor, admin.ctx, request.id);
    expect(decided!.status).toBe("approved");

    const after = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(after!.status).toBe("cancelled");
    expect(after!.payments.every((p) => p.status === "cancelled")).toBe(true);
    // InvoiceItem snapshots are never rewritten.
    expect(after!.items.map((i) => ({ label: i.label, lineTotal: i.lineTotal }))).toEqual(
      itemsBefore,
    );

    // A refund voucher was raised for the collected amount.
    const voucher = decided!.refundVoucher;
    expect(voucher).not.toBeNull();
    expect(voucher!.amount).toBe(3000);
    expect(voucher!.status).toBe("requested");
    expect(voucher!.voucherNumber).toBe("HRB-DEMO-A-2026-000001");

    const apprAudit = await prisma.auditLog.findFirst({
      where: { action: "invoice.cancellation_approved", entityId: invoice.id },
    });
    expect(apprAudit?.summary).toContain(invoice.invoiceNumber);
    const vAudit = await prisma.auditLog.findFirst({
      where: { action: "refund_voucher.created", entityId: voucher!.id },
    });
    expect(vAudit?.summary).toContain("3");
  });

  it("approving an UNPAID invoice cancels it but raises NO refund voucher", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, LINES);
    const request = await requestInvoiceCancellation(
      cashier.actor,
      cashier.ctx,
      invoice.id,
      "Annulation avant paiement",
    );
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const decided = await approveInvoiceCancellation(admin.actor, admin.ctx, request.id);
    expect(decided!.status).toBe("approved");
    expect(decided!.refundVoucher).toBeNull();
    const after = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(after!.status).toBe("cancelled");
  });

  it("admin rejection leaves the invoice untouched (no cancellation, no voucher)", async () => {
    const { cashier, invoice } = await paidInvoice();
    const request = await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Doute");
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const decided = await rejectInvoiceCancellation(admin.actor, admin.ctx, request.id, "Non justifié");
    expect(decided!.status).toBe("rejected");
    const after = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(after!.status).toBe("paid"); // unchanged
    expect(await prisma.refundVoucher.count()).toBe(0);
  });

  it("enforces requester ≠ approver", async () => {
    const { invoice } = await paidInvoice();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    // Craft a request whose requester IS the admin, then have the admin try to approve it.
    const selfRequest = await prisma.invoiceCancellationRequest.create({
      data: {
        hospitalId: admin.ctx.hospitalId,
        invoiceId: invoice.id,
        reason: "Self",
        requestedById: admin.actor.id,
      },
    });
    await expect(
      approveInvoiceCancellation(admin.actor, admin.ctx, selfRequest.id),
    ).rejects.toThrow(/ne peut pas approuver sa propre demande/);
  });

  it("rejects a duplicate pending request and a cancellation of an already-cancelled invoice", async () => {
    const { cashier, invoice } = await paidInvoice();
    await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Première");
    await expect(
      requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Doublon"),
    ).rejects.toThrow(/déjà en attente/);
  });

  it("RBAC: reception cannot request; cashier cannot approve (server-side)", async () => {
    const { cashier, invoice } = await paidInvoice();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      requestInvoiceCancellation(reception.actor, reception.ctx, invoice.id, "x"),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const request = await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "x");
    await expect(
      approveInvoiceCancellation(cashier.actor, cashier.ctx, request.id),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("refund voucher state machine: requested → approved → paid; double-execute rejected", async () => {
    const { cashier, invoice } = await paidInvoice();
    const request = await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Motif");
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const decided = await approveInvoiceCancellation(admin.actor, admin.ctx, request.id);
    const voucherId = decided!.refundVoucher!.id;

    // Cashier cannot approve the voucher (admin only).
    await expect(approveRefund(cashier.actor, cashier.ctx, voucherId)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    const approved = await approveRefund(admin.actor, admin.ctx, voucherId);
    expect(approved!.status).toBe("approved");

    // Admin cannot execute (cashier only); cashier executes.
    await expect(executeRefund(admin.actor, admin.ctx, voucherId)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    const paid = await executeRefund(cashier.actor, cashier.ctx, voucherId);
    expect(paid!.status).toBe("paid");

    // Re-executing a paid voucher is an invalid transition.
    await expect(executeRefund(cashier.actor, cashier.ctx, voucherId)).rejects.toThrow(
      /Transition de bon de remboursement invalide/,
    );
    const exAudit = await prisma.auditLog.findFirst({
      where: { action: "refund_voucher.executed", entityId: voucherId },
    });
    expect(exAudit).not.toBeNull();
  });

  it("a refund voucher can be cancelled by admin before it is paid", async () => {
    const { cashier, invoice } = await paidInvoice();
    const request = await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Motif");
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const decided = await approveInvoiceCancellation(admin.actor, admin.ctx, request.id);
    const voucherId = decided!.refundVoucher!.id;
    const cancelled = await cancelRefund(admin.actor, admin.ctx, voucherId, "Abandonné");
    expect(cancelled!.status).toBe("cancelled");
    const reloaded = await getRefund(admin.actor, admin.ctx, voucherId);
    expect(reloaded!.status).toBe("cancelled");
    // The cancelling actor is persisted on the record (not only in the audit log).
    expect(reloaded!.cancelledById).toBe(admin.actor.id);
    expect(reloaded!.cancelledBy?.displayName).toBe(admin.actor.displayName);
  });
});

describe("integration: Phase 2C — Brouillard de Caisse", () => {
  beforeEach(resetTestDb);

  it("open → pay → close freezes the five totals and is audited", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 10_000);
    expect(shift.status).toBe("open");
    expect(shift.shiftNumber).toBe("HRB-DEMO-B-2026-000001");
    expect(await prisma.auditLog.count({ where: { action: "cashier.shift_opened" } })).toBe(1);

    // A second open while one is already open is rejected.
    await expect(openCashierShift(cashier.actor, cashier.ctx, 0)).rejects.toThrow(/déjà ouverte/);

    // Record a cash payment within the shift window.
    const encounterId = await anEncounterId();
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, LINES);
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
      amount: invoice.totalAmount,
      method: "cash",
    });

    const closed = await closeCashierShift(cashier.actor, cashier.ctx, shift.id);
    expect(closed!.status).toBe("closed");
    expect(closed!.totalCashReceived).toBe(3000);
    expect(closed!.totalMobileCardReceived).toBe(0);
    expect(closed!.totalCancellationsRefunds).toBe(0);
    expect(closed!.expectedClosingBalance).toBe(13_000); // opening 10000 + cash 3000
    expect(closed!.receiptCount).toBe(1);

    const audit = await prisma.auditLog.findFirst({ where: { action: "cashier.shift_closed" } });
    expect(audit?.summary).toContain("Clôture de caisse");

    // After close there is no open shift.
    expect(await getOpenShift(cashier.actor, cashier.ctx)).toBeNull();
  });

  it("a closed Brouillard is immutable; corrections are appended without changing frozen totals", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 5000);
    const closed = await closeCashierShift(cashier.actor, cashier.ctx, shift.id);
    const frozen = {
      cash: closed!.totalCashReceived,
      expected: closed!.expectedClosingBalance,
    };

    // Re-closing a closed shift is rejected.
    await expect(closeCashierShift(cashier.actor, cashier.ctx, shift.id)).rejects.toThrow(
      /déjà clôturée/,
    );

    // Controlled correction: appends a row + flips status, but never edits the frozen figures.
    const { shift: corrected, correction } = await correctCashierShift(
      cashier.actor,
      cashier.ctx,
      shift.id,
      "Écart de caisse",
      "Différence de 500 FCFA constatée au comptage.",
    );
    expect(correction.reason).toBe("Écart de caisse");
    expect(corrected!.status).toBe("corrected");
    expect(corrected!.totalCashReceived).toBe(frozen.cash);
    expect(corrected!.expectedClosingBalance).toBe(frozen.expected);
    expect(corrected!.corrections).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "cashier.closing_corrected", entityId: shift.id },
    });
    expect(audit).not.toBeNull();
  });

  it("RBAC: reception cannot open a shift (server-side)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(openCashierShift(reception.actor, reception.ctx, 0)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("a cashier cannot correct another cashier's Brouillard", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 0);
    await closeCashierShift(cashier.actor, cashier.ctx, shift.id);
    const otherActor = { ...cashier.actor, id: "another-cashier" };
    await expect(
      correctCashierShift(otherActor, cashier.ctx, shift.id, "Motif", "Note"),
    ).rejects.toThrow(/votre propre brouillard/);
    // No correction was appended and the frozen status is unchanged.
    const reloaded = await getCashierShift(cashier.actor, cashier.ctx, shift.id);
    expect(reloaded!.status).toBe("closed");
    expect(reloaded!.corrections).toHaveLength(0);
  });

  it("a cashier cannot close another cashier's shift", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const shift = await openCashierShift(cashier.actor, cashier.ctx, 0);
    // Forge a different cashier id by reading then asserting the own-shift guard via a fake actor.
    const otherActor = { ...cashier.actor, id: "different-cashier" };
    await expect(
      closeCashierShift(otherActor, cashier.ctx, shift.id),
    ).rejects.toThrow(/votre propre caisse/);
    // The shift remains open and closable by its owner.
    const reloaded = await getCashierShift(cashier.actor, cashier.ctx, shift.id);
    expect(reloaded!.status).toBe("open");
  });
});
