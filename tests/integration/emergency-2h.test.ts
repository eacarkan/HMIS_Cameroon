import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  accrueEmergencyDebt,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  flagEncounterEmergency,
  getEmergencyDebtSummary,
  openEncounter,
  sendPrescriptionToPharmacy,
  settleEmergencyDebt,
  waiveEmergencyDebt,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function paraMedId() {
  const m = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
  return m!.id;
}

/** Open an encounter (optionally flagged emergency) with a sent Paracétamol prescription. */
async function emergencyEncounterWithPrescription(opts: { emergency: boolean }) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "URGENCE",
    givenName: "Test",
    sex: "male",
    dateOfBirth: new Date("1990-01-01"),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Détresse",
  });
  if (opts.emergency) {
    await flagEncounterEmergency(reception.actor, reception.ctx, enc.id, true);
  }
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const presc = await createPrescription(doctor.actor, doctor.ctx, {
    encounterId: enc.id,
    items: [{ medicationId: await paraMedId(), dosage: "1 cp", duration: "5j", quantity: 10 }],
  });
  await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
  await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
  return { encounterId: enc.id, prescId: presc.id };
}

describe("integration: Phase 2H — emergency exception", () => {
  beforeEach(resetTestDb);

  it("dispensing BYPASSES the cashier paid-check on an emergency encounter (treat first)", async () => {
    const { prescId } = await emergencyEncounterWithPrescription({ emergency: true });
    // No confirmPrescriptionPayment — the pharmacy dispenses anyway because it is an emergency.
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const record = await dispensePrescription(pharm.actor, pharm.ctx, prescId);
    expect(record.dispenseNumber).toMatch(/HRB-DEMO-D-2026-/);
    const audit = await prisma.auditLog.findFirst({ where: { action: "dispense.completed", entityId: record.id } });
    expect(audit?.summary).toContain("URGENCE");
  });

  it("a NON-emergency unpaid prescription is still blocked (the paid-check holds)", async () => {
    const { prescId } = await emergencyEncounterWithPrescription({ emergency: false });
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(dispensePrescription(pharm.actor, pharm.ctx, prescId)).rejects.toThrow(/payée à la caisse/);
  });

  it("debt accrues only on an emergency encounter; settle then a second accrual; reads back", async () => {
    const { encounterId } = await emergencyEncounterWithPrescription({ emergency: true });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const d1 = await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 3000, source: "Consultation" });
    await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 1500, source: "Soins" });

    const reception = await loginAndSelect(ACCOUNTS.reception);
    const summary = await getEmergencyDebtSummary(reception.actor, reception.ctx, encounterId);
    expect(summary.outstandingTotal).toBe(4500);
    expect(summary.hasOutstanding).toBe(true);

    await settleEmergencyDebt(cashier.actor, cashier.ctx, d1.id);
    const after = await getEmergencyDebtSummary(reception.actor, reception.ctx, encounterId);
    expect(after.outstandingTotal).toBe(1500); // only the 1500 entry remains outstanding
    const audit = await prisma.auditLog.findFirst({ where: { action: "emergency.debt_settled", entityId: d1.id } });
    expect(audit).not.toBeNull();
  });

  it("accrual is refused on a non-emergency encounter and for a role without the cap", async () => {
    const { encounterId } = await emergencyEncounterWithPrescription({ emergency: false });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(
      accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 1000, source: "x" }),
    ).rejects.toThrow(/marquée urgence/);

    const { encounterId: emEnc } = await emergencyEncounterWithPrescription({ emergency: true });
    const doctor = await loginAndSelect(ACCOUNTS.doctor); // doctor has no accrue cap
    await expect(
      accrueEmergencyDebt(doctor.actor, doctor.ctx, { encounterId: emEnc, amount: 1000, source: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("ONLY the Hospital Director may waive (with a reason); the cashier cannot; double-decide is rejected", async () => {
    const { encounterId } = await emergencyEncounterWithPrescription({ emergency: true });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const debt = await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 5000, source: "Soins d'urgence" });

    // The cashier cannot waive.
    await expect(waiveEmergencyDebt(cashier.actor, cashier.ctx, debt.id, "tentative")).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    // The director waives with a reason.
    const director = await loginAndSelect(ACCOUNTS.director);
    await waiveEmergencyDebt(director.actor, director.ctx, debt.id, "Patient indigent — décision sociale");
    const reloaded = await prisma.emergencyDebt.findUnique({ where: { id: debt.id } });
    expect(reloaded!.status).toBe("waived");
    expect(reloaded!.decisionReason).toContain("indigent");
    // A second decision is rejected.
    await expect(settleEmergencyDebt(cashier.actor, cashier.ctx, debt.id)).rejects.toThrow(/déjà été traitée/);
  });

  it("an encounter cannot be un-flagged while it still has outstanding debt", async () => {
    const { encounterId } = await emergencyEncounterWithPrescription({ emergency: true });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 2000, source: "x" });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(flagEncounterEmergency(reception.actor, reception.ctx, encounterId, false)).rejects.toThrow(
      /dette d'urgence est encore en cours/,
    );
  });

  // Review-hardening (2H §9): the un-flag and the accrual race on the same encounter. Whichever wins,
  // the invariant "isEmergency=false ⇒ no outstanding debt" must hold — the operations serialise on the
  // encounter row lock (server/db `unflagEncounterEmergencyTx` / `accrueEmergencyDebtTx`).
  it("concurrent un-flag vs accrual never leaves a non-emergency encounter WITH outstanding debt", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const reception = await loginAndSelect(ACCOUNTS.reception);
    // Several fresh encounters to exercise both interleavings (accrue-first and un-flag-first).
    for (let i = 0; i < 6; i++) {
      const { encounterId } = await emergencyEncounterWithPrescription({ emergency: true });
      // Fire the accrual and the un-flag concurrently; exactly one effect "wins", both may also be refused.
      await Promise.allSettled([
        accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId, amount: 2500, source: "Soins" }),
        flagEncounterEmergency(reception.actor, reception.ctx, encounterId, false),
      ]);
      const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
      const outstanding = await prisma.emergencyDebt.count({
        where: { hospitalId: HRB, encounterId, status: "outstanding" },
      });
      // THE INVARIANT: a non-emergency encounter must never carry outstanding emergency debt.
      expect(enc!.isEmergency === false && outstanding > 0).toBe(false);
    }
  });
});
