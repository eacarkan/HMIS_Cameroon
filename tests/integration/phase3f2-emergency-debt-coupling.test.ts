import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  accrueEmergencyDebt,
  assignWard,
  authorizeDischarge,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  flagEncounterEmergency,
  generateDailyWardCharge,
  openEncounter,
  recordPayment,
  requestAdmission,
  requestDiagnostic,
  sendPrescriptionToPharmacy,
  startDiagnostic,
  waiveEmergencyDebt,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3F-2 — Emergency debt auto-coupling (doc 34 §10). VERIFIES the Phase 2 hardening delivered
 * as H4 (commit 17a9fa1) + the 2H/2G workflow: an emergency-bypassed action automatically creates or
 * links an EmergencyDebt (so it can never silently disappear), a non-emergency bypass is refused, the
 * Director waiver requires a reason + is audited, the discharge gate sees all emergency debt, and
 * cross-hospital debt access is denied. Maps to doc 34 §10.14. No logic re-implemented. Synthetic only.
 */
const HRB = "hosp-hrb-demo";

async function emergencyEncounter() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "URGENCE", givenName: "Probe", sex: "female", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Urgence" });
  await flagEncounterEmergency(reception.actor, reception.ctx, enc.id, true);
  return { reception, encounterId: enc.id };
}

async function sendPrescription(encounterId: string) {
  const med = await prisma.medication.findFirstOrThrow({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const presc = await createPrescription(doctor.actor, doctor.ctx, {
    encounterId,
    items: [{ medicationId: med.id, dosage: "1 cp", duration: "5j", quantity: 5 }],
  });
  await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
  await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
  return presc;
}

describe("integration: Phase 3F-2 emergency debt auto-coupling (verifies H4)", () => {
  beforeEach(resetTestDb);

  it("emergency pharmacy dispense auto-creates/links an outstanding EmergencyDebt", async () => {
    const { encounterId } = await emergencyEncounter();
    const presc = await sendPrescription(encounterId);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id); // emergency bypass — unpaid
    const debts = await prisma.emergencyDebt.findMany({ where: { hospitalId: HRB, encounterId } });
    expect(debts.length).toBe(1);
    expect(debts[0].status).toBe("outstanding");
  });

  it("emergency lab/radiology start auto-accrues the priced EmergencyDebt (catalogue price)", async () => {
    const { encounterId } = await emergencyEncounter();
    const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: item.id });
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, order.id); // emergency bypass — unpaid
    const debts = await prisma.emergencyDebt.findMany({ where: { hospitalId: HRB, encounterId } });
    expect(debts.length).toBe(1);
    expect(debts[0].amount).toBe(item.price);
    expect(debts[0].status).toBe("outstanding");
  });

  it("a NON-emergency unpaid dispense is refused (no bypass without the emergency flag)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "NORMAL", givenName: "Probe", sex: "male", dateOfBirth: new Date("1985-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "RAS" });
    const presc = await sendPrescription(enc.id); // NOT flagged emergency, NOT paid
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(dispensePrescription(pharm.actor, pharm.ctx, presc.id)).rejects.toThrow();
    // No emergency debt is created on the refused path.
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId: enc.id } })).toBe(0);
  });

  it("the Director waiver requires a reason and is audited", async () => {
    const { encounterId } = await emergencyEncounter();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const debt = await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 2000, source: "Soins d'urgence" });
    const director = await loginAndSelect(ACCOUNTS.director);
    // Empty reason is refused.
    await expect(waiveEmergencyDebt(director.actor, director.ctx, debt.id, "  ")).rejects.toThrow(/motif/i);
    // With a reason → waived + audited.
    await waiveEmergencyDebt(director.actor, director.ctx, debt.id, "Indigence confirmée");
    expect((await prisma.emergencyDebt.findUniqueOrThrow({ where: { id: debt.id } })).status).toBe("waived");
    const audits = await prisma.auditLog.findMany({ where: { action: "emergency.debt_waived", entityId: debt.id } });
    expect(audits.length).toBe(1);
    expect(audits[0].summary).toMatch(/Indigence confirmée/);
    // A non-Director cannot waive.
    const debt2 = await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 1000, source: "Autre" });
    await expect(waiveEmergencyDebt(cashier.actor, cashier.ctx, debt2.id, "x")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("discharge is blocked while an emergency debt is unresolved (the gate sees emergency debt)", async () => {
    const { reception, encounterId } = await emergencyEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const admission = await requestAdmission(doctor.actor, doctor.ctx, encounterId, { reason: "Surveillance" });
    const ward = await prisma.serviceUnit.findFirstOrThrow({ where: { hospitalId: HRB, code: "SRV-MED-INTERNE" } });
    await assignWard(reception.actor, reception.ctx, admission.id, { wardServiceUnitId: ward.id });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const charge = await generateDailyWardCharge(cashier.actor, cashier.ctx, admission.id);
    await recordPayment(cashier.actor, cashier.ctx, charge.invoiceId, { amount: charge.amount, method: "cash" });
    // Invoice settled, but an outstanding emergency debt still blocks discharge.
    await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 3000, source: "Urgence" });
    await expect(authorizeDischarge(doctor.actor, doctor.ctx, admission.id)).rejects.toThrow(/dette/i);
  });

  it("cross-hospital emergency-debt accrual is blocked (per-hospital RBAC)", async () => {
    const { encounterId } = await emergencyEncounter();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(
      accrueEmergencyDebt(
        cashier.actor,
        { ...cashier.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" },
        { encounterId, amount: 1000, source: "x" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
