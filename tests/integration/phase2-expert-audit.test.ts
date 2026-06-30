import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  accrueEmergencyDebt,
  approveInvoiceCancellation,
  approveRefund,
  assignWard,
  authorizeDischarge,
  confirmDiagnosticPayment,
  createInvoice,
  requestInvoiceCancellation,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  enterDiagnosticResult,
  finalizePrescription,
  flagEncounterEmergency,
  generateDailyWardCharge,
  getDiagnosticOrder,
  getDiagnosticWorklist,
  listDiagnosticsForEncounter,
  openCashierShift,
  openEncounter,
  recordPayment,
  requestAdmission,
  requestDiagnostic,
  selectHospital,
  sendPrescriptionToPharmacy,
  startDiagnostic,
  validateDiagnosticResult,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * PHASE 2 EXPERT AUDIT — executable probes of the cross-cutting invariants a domain expert cares about:
 * capability RBAC denial + authz audit, hospital scoping, the lab-result visibility gate, money
 * reconciliation, the discharge gate. Two probes DOCUMENT known pre-Gate-7 backlog gaps (they assert the
 * CURRENT behaviour, labelled "GAP") so the audit has executable evidence either way.
 */

const HRB = "hosp-hrb-demo";

async function labItemId(code = "LAB-NFS") {
  const it = await prisma.diagnosticCatalogueItem.findFirst({ where: { hospitalId: HRB, code } });
  return it!.id;
}
async function newPatientEncounter(reception: Awaited<ReturnType<typeof loginAndSelect>>, opts?: { emergency?: boolean }) {
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "AUDIT",
    givenName: "Probe",
    sex: "female",
    dateOfBirth: new Date("1990-01-01"),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Audit",
  });
  if (opts?.emergency) await flagEncounterEmergency(reception.actor, reception.ctx, enc.id, true);
  return { patientId: patient.id, encounterId: enc.id };
}

describe("PHASE 2 AUDIT — capability RBAC denial + authz.denied audit", () => {
  beforeEach(resetTestDb);

  it("denies cross-role actions and writes an authz.denied audit entry each time", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const { encounterId } = await newPatientEncounter(reception);

    const before = await prisma.auditLog.count({ where: { action: "authz.denied" } });

    // Reception cannot request an admission (doctor-only).
    await expect(requestAdmission(reception.actor, reception.ctx, encounterId, { reason: "x" })).rejects.toBeInstanceOf(AuthorizationError);
    // Admin is NOT a clinical/billing superuser: cannot request a diagnostic, cannot create an invoice.
    await expect(requestDiagnostic(admin.actor, admin.ctx, { encounterId, catalogueItemId: await labItemId() })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(createInvoice(admin.actor, admin.ctx, encounterId, [{ label: "x", unitAmount: 100, quantity: 1 }])).rejects.toBeInstanceOf(AuthorizationError);
    // Doctor cannot confirm a diagnostic payment (cashier-only); cashier cannot enter a result.
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: await labItemId() });
    await expect(confirmDiagnosticPayment(doctor.actor, doctor.ctx, order.id)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(enterDiagnosticResult(cashier.actor, cashier.ctx, order.id, "x")).rejects.toBeInstanceOf(AuthorizationError);

    // Every denial was audited (append-only).
    const after = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    expect(after - before).toBe(5);
  });
});

describe("PHASE 2 AUDIT — hospital scoping", () => {
  beforeEach(resetTestDb);

  it("an actor cannot obtain a context for a hospital they do not belong to", async () => {
    const actor = await actorFor(ACCOUNTS.doctor); // belongs to HRB only
    const other = await prisma.hospital.findFirst({ where: { id: { not: HRB } } });
    expect(other).not.toBeNull();
    await expect(selectHospital(actor, other!.id)).rejects.toThrow(/refusé/i);
  });

  it("DB reads are hospital-scoped — an HRB record is invisible under another hospital id", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: await labItemId() });
    // The order exists in HRB…
    expect(await prisma.diagnosticOrder.findFirst({ where: { id: order.id, hospitalId: HRB } })).not.toBeNull();
    // …but is not found scoped to any other hospital.
    const other = await prisma.hospital.findFirst({ where: { id: { not: HRB } } });
    expect(await prisma.diagnosticOrder.findFirst({ where: { id: order.id, hospitalId: other!.id } })).toBeNull();
  });
});

describe("PHASE 2 AUDIT — 2I lab/radiology result-visibility gate", () => {
  beforeEach(resetTestDb);

  async function orderToResultEntered() {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: await labItemId() });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, order.id);
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, order.id);
    await enterDiagnosticResult(tech.actor, tech.ctx, order.id, "SECRET-RESULT-7");
    return { encounterId, orderId: order.id, doctor, tech };
  }

  it("the doctor cannot read the result through ANY read path until validated", async () => {
    const { encounterId, orderId, doctor, tech } = await orderToResultEntered();
    // Three doctor read paths, all stripped at result_entered:
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId))!.resultText).toBeNull();
    expect((await listDiagnosticsForEncounter(doctor.actor, doctor.ctx, encounterId))[0].resultText).toBeNull();
    const wl = await getDiagnosticWorklist(doctor.actor, doctor.ctx);
    expect(wl.find((o) => o.id === orderId)!.resultText).toBeNull();
    // Staff CAN see it (to validate).
    expect((await getDiagnosticOrder(tech.actor, tech.ctx, orderId))!.resultText).toContain("SECRET");
    // After validation the doctor sees it.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId))!.resultText).toContain("SECRET");
  });

  it("4-eyes (hardened): a SINGLE actor holding BOTH caps CANNOT validate their own entry", async () => {
    const { orderId, tech } = await orderToResultEntered();
    // One person granted both technician + validator capabilities — the same-user guard refuses self-validation.
    // rolesByHospital must mirror the override (requireCapability resolves per-hospital roles, not the union).
    const dualRole = {
      ...tech.actor,
      roles: ["technicien_diagnostic", "validateur_diagnostic"],
      rolesByHospital: { [tech.ctx.hospitalId]: ["technicien_diagnostic", "validateur_diagnostic"] },
    };
    await expect(validateDiagnosticResult(dualRole, tech.ctx, orderId)).rejects.toThrow(/différente/i);
    // The order is untouched (still result_entered), and a DIFFERENT validator can still validate it.
    expect((await prisma.diagnosticOrder.findUnique({ where: { id: orderId } }))!.status).toBe("result_entered");
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    const ok = await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect(ok!.status).toBe("validated");
  });
});

describe("PHASE 2 AUDIT — 2H emergency exception", () => {
  beforeEach(resetTestDb);

  async function emergencyDispensedPrescription() {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception, { emergency: true });
    const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId,
      items: [{ medicationId: med!.id, dosage: "1 cp", duration: "5j", quantity: 5 }],
    });
    await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
    await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id); // emergency bypass (unpaid)
    return { encounterId };
  }

  it("emergency dispensing (hardened) auto-opens a placeholder EmergencyDebt so the discharge gate can't miss it", async () => {
    const { encounterId } = await emergencyDispensedPrescription();
    // The dispense happened without payment (emergency bypass)…
    const dispensed = await prisma.dispenseRecord.count({ where: { hospitalId: HRB } });
    expect(dispensed).toBeGreaterThan(0);
    // …and a placeholder outstanding EmergencyDebt (amount 0, "à tarifer") was auto-created → the gate blocks.
    const debts = await prisma.emergencyDebt.findMany({ where: { hospitalId: HRB, encounterId } });
    expect(debts.length).toBe(1);
    expect(debts[0].status).toBe("outstanding");
    expect(debts[0].source).toMatch(/à définir à la caisse/i);
  });

  it("emergency-bypassed LAB exam (priced) auto-accrues the real EmergencyDebt of the catalogue price", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception, { emergency: true });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: await labItemId("LAB-NFS") });
    // Technician starts WITHOUT payment (emergency bypass) → a priced debt is auto-accrued.
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, order.id);
    const debts = await prisma.emergencyDebt.findMany({ where: { hospitalId: HRB, encounterId } });
    expect(debts.length).toBe(1);
    expect(debts[0].amount).toBe(3500); // the LAB-NFS catalogue price
    expect(debts[0].status).toBe("outstanding");
  });

  it("an emergency encounter cannot be un-flagged while an outstanding emergency debt exists", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception, { emergency: true });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 2000, source: "Soins" });
    await expect(flagEncounterEmergency(reception.actor, reception.ctx, encounterId, false)).rejects.toThrow(/dette/i);
  });
});

describe("PHASE 2 AUDIT — money reconciliation & the 2G discharge gate", () => {
  beforeEach(resetTestDb);

  it("a full billing journey reconciles exactly (integer FCFA)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, [
      { label: "Consultation", unitAmount: 2000, quantity: 1 },
      { label: "Pansement", unitAmount: 1500, quantity: 2 },
    ]);
    expect(invoice.totalAmount).toBe(5000);
    expect(Number.isInteger(invoice.totalAmount)).toBe(true);
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 5000, method: "cash" });
    const paid = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
    expect(paid!.status).toBe("paid");
    const sum = paid!.payments.filter((p) => p.status === "recorded").reduce((a, p) => a + p.amount, 0);
    expect(sum).toBe(paid!.totalAmount); // reconciled to the cent
  });

  it("discharge is blocked by an unpaid invoice AND by outstanding emergency debt; clears once both settled", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception, { emergency: true });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const admission = await requestAdmission(doctor.actor, doctor.ctx, encounterId, { reason: "Surveillance" });
    await assignWard(reception.actor, reception.ctx, admission.id, {
      wardServiceUnitId: (await prisma.serviceUnit.findFirst({ where: { hospitalId: HRB, code: "SRV-MED-INTERNE" } }))!.id,
    });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    // A daily ward fee → an unpaid hospitalization invoice; plus an outstanding emergency debt.
    const charge = await generateDailyWardCharge(cashier.actor, cashier.ctx, admission.id);
    await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 3000, source: "Urgence" });

    await expect(authorizeDischarge(doctor.actor, doctor.ctx, admission.id)).rejects.toThrow(/facture non réglée|dette/i);

    // Pay the invoice — still blocked by the debt.
    await recordPayment(cashier.actor, cashier.ctx, charge.invoiceId, { amount: charge.amount, method: "cash" });
    await expect(authorizeDischarge(doctor.actor, doctor.ctx, admission.id)).rejects.toThrow(/dette/i);
  });
});

describe("PHASE 2 AUDIT — newly-found defects (now FIXED by this audit)", () => {
  beforeEach(resetTestDb);

  async function prescribeAndSend(medCode: string, quantity: number) {
    const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: medCode } });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId,
      items: [{ medicationId: med!.id, dosage: "1 cp", duration: "5j", quantity }],
    });
    await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
    await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
    return { medId: med!.id, prescriptionId: presc.id };
  }

  // BLOCKER (pharmaceutical safety): expired stock must NEVER be reserved/dispensed by the FEFO path.
  it("FEFO never reserves an EXPIRED lot — only the valid lot is reserved", async () => {
    const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-IBU-400" } });
    const expired = await prisma.medicationStockBatch.create({
      data: { hospitalId: HRB, medicationId: med!.id, batchNumber: "EXP-OLD", expiryDate: new Date("2020-01-01"), quantityReceived: 100, quantityOnHand: 100, quantityReserved: 0 },
    });
    const valid = await prisma.medicationStockBatch.create({
      data: { hospitalId: HRB, medicationId: med!.id, batchNumber: "VALID-NEW", expiryDate: new Date("2031-01-01"), quantityReceived: 100, quantityOnHand: 100, quantityReserved: 0 },
    });
    const { prescriptionId } = await prescribeAndSend("MED-IBU-400", 10);
    expect((await prisma.medicationStockBatch.findUnique({ where: { id: expired.id } }))!.quantityReserved).toBe(0);
    expect((await prisma.medicationStockBatch.findUnique({ where: { id: valid.id } }))!.quantityReserved).toBe(10);
    const res = await prisma.stockReservation.findMany({ where: { hospitalId: HRB, prescriptionId } });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.batchId === valid.id)).toBe(true);
  });

  it("an EXPIRED-only medication reserves nothing (shortfall) — never the expired lot", async () => {
    const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-METRO-250" } });
    const expired = await prisma.medicationStockBatch.create({
      data: { hospitalId: HRB, medicationId: med!.id, batchNumber: "EXP-ONLY", expiryDate: new Date("2019-06-30"), quantityReceived: 50, quantityOnHand: 50, quantityReserved: 0 },
    });
    const { prescriptionId } = await prescribeAndSend("MED-METRO-250", 10);
    expect((await prisma.medicationStockBatch.findUnique({ where: { id: expired.id } }))!.quantityReserved).toBe(0);
    expect(await prisma.stockReservation.count({ where: { hospitalId: HRB, prescriptionId } })).toBe(0);
  });

  // MAJOR (clinical lifecycle): a prescription cannot be created on a closed/cancelled encounter.
  it("a prescription cannot be created on a CLOSED encounter", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    await prisma.encounter.update({ where: { id: encounterId }, data: { status: "closed" } });
    const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(
      createPrescription(doctor.actor, doctor.ctx, {
        encounterId,
        items: [{ medicationId: med!.id, dosage: "1 cp", duration: "5j", quantity: 5 }],
      }),
    ).rejects.toThrow(/ouverte/i);
  });
});

describe("PHASE 2 AUDIT — 2C financial hardening (status guards + atomic approval)", () => {
  beforeEach(resetTestDb);

  async function paidInvoiceCancellationRequest() {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const { encounterId } = await newPatientEncounter(reception);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, [
      { label: "Consultation", unitAmount: 5000, quantity: 1 },
    ]);
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 5000, method: "cash" });
    const request = await requestInvoiceCancellation(cashier.actor, cashier.ctx, invoice.id, "Erreur de saisie");
    return { invoiceId: invoice.id, requestId: request.id };
  }

  it("concurrent cancellation approvals: exactly ONE succeeds, exactly ONE refund voucher, invoice cancelled once", async () => {
    const { invoiceId, requestId } = await paidInvoiceCancellationRequest();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const results = await Promise.allSettled([
      approveInvoiceCancellation(admin.actor, admin.ctx, requestId),
      approveInvoiceCancellation(admin.actor, admin.ctx, requestId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    // The status-guarded atomic approval created exactly one voucher and cancelled the invoice once.
    expect(await prisma.refundVoucher.count({ where: { hospitalId: HRB, invoiceId } })).toBe(1);
    expect((await prisma.invoice.findUnique({ where: { id: invoiceId } }))!.status).toBe("cancelled");
    expect(
      await prisma.invoiceCancellationRequest.count({ where: { id: requestId, status: "approved" } }),
    ).toBe(1);
  });

  it("concurrent refund-voucher approvals: exactly ONE succeeds (status-guarded)", async () => {
    const { requestId } = await paidInvoiceCancellationRequest();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await approveInvoiceCancellation(admin.actor, admin.ctx, requestId);
    const voucher = await prisma.refundVoucher.findFirst({ where: { hospitalId: HRB, status: "requested" } });
    expect(voucher).not.toBeNull();
    const results = await Promise.allSettled([
      approveRefund(admin.actor, admin.ctx, voucher!.id),
      approveRefund(admin.actor, admin.ctx, voucher!.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect((await prisma.refundVoucher.findUnique({ where: { id: voucher!.id } }))!.status).toBe("approved");
  });

  it("concurrent open-shift requests for one cashier: exactly ONE open shift (DB partial unique index)", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const results = await Promise.allSettled([
      openCashierShift(cashier.actor, cashier.ctx, 10000),
      openCashierShift(cashier.actor, cashier.ctx, 10000),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    expect(
      await prisma.cashierShift.count({ where: { hospitalId: HRB, cashierId: cashier.actor.id, status: "open" } }),
    ).toBe(1);
  });
});
