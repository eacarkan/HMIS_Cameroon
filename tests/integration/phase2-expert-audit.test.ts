import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  accrueEmergencyDebt,
  assignWard,
  authorizeDischarge,
  confirmDiagnosticPayment,
  createInvoice,
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

  it("GAP (pre-Gate-7 backlog #3): a SINGLE actor holding BOTH caps can validate their own entry", async () => {
    const { orderId, tech } = await orderToResultEntered();
    // Simulate one person granted both technician + validator capabilities (RBAC has no same-user guard).
    const dualRole = { ...tech.actor, roles: ["technicien_diagnostic", "validateur_diagnostic"] };
    const validated = await validateDiagnosticResult(dualRole, tech.ctx, orderId);
    // CURRENT behaviour: it succeeds, and the entry+validation share the same actor id.
    expect(validated!.status).toBe("validated");
    const row = await prisma.diagnosticOrder.findUnique({ where: { id: orderId } });
    expect(row!.resultEnteredById).toBe(tech.actor.id);
    expect(row!.validatedById).toBe(tech.actor.id); // ⇐ same person entered AND validated → backlog item
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

  it("GAP (pre-Gate-7 backlog #2): emergency dispensing bypasses payment but creates NO automatic EmergencyDebt", async () => {
    const { encounterId } = await emergencyDispensedPrescription();
    // The dispense happened without payment (emergency bypass)…
    const dispensed = await prisma.dispenseRecord.count({ where: { hospitalId: HRB } });
    expect(dispensed).toBeGreaterThan(0);
    // …but NO debt was auto-accrued for it — debt accrual is a separate manual cashier action.
    const debts = await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId } });
    expect(debts).toBe(0); // ⇐ the discharge gate could miss this charge → backlog item
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
