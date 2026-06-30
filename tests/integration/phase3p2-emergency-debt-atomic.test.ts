import { beforeEach, describe, expect, it } from "vitest";

import {
  confirmDiagnosticPayment,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  flagEncounterEmergency,
  openEncounter,
  requestDiagnostic,
  sendPrescriptionToPharmacy,
  startDiagnostic,
} from "@/server/services";
import { accrueEmergencyDebtWithinTx, startDiagnosticTx } from "@/server/db";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3 QA patch 3P-2 — Emergency-bypass debt is now ATOMIC with the triggering action (mentor
 * follow-up). The placeholder/priced EmergencyDebt is accrued INSIDE the same `$transaction` as the
 * pharmacy dispense / diagnostic start, so the two commit-or-fail together. These tests prove the four
 * guarantees: (1) the action rolls back entirely if the debt cannot be created (no orphaned service);
 * (2) once the debt is coupled, the encounter cannot be un-flagged while it is outstanding (the un-flag
 * serialisation invariant); (3) accrual is idempotent by source (no duplicate on retry); (4) a retried
 * emergency dispense / lab start is safely guarded (no duplicate debt). Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

async function emergencyEncounter() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "URGENCE", givenName: "Atomic", sex: "female", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
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

describe("integration: Phase 3P-2 emergency-bypass debt is atomic with the triggering action", () => {
  beforeEach(resetTestDb);

  it("(1) the start+debt transaction rolls back entirely if the coupled debt cannot be created (no orphaned service)", async () => {
    // A NON-emergency encounter: accruing an emergency debt against it is illegal, so the in-tx accrual
    // throws — and because the debt is folded into the SAME transaction as the status transition, the
    // whole start rolls back. The exam is NOT left started, and no debt row leaks.
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "ATOMIC", givenName: "NoDebt", sex: "male", dateOfBirth: new Date("1980-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "RAS" });
    const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId: enc.id, catalogueItemId: item.id });

    await expect(
      startDiagnosticTx({
        hospitalId: HRB,
        id: order.id,
        emergencyDebt: {
          hospitalId: HRB,
          encounterId: enc.id,
          patientId: order.patientId,
          amount: item.price,
          source: `Examen d'urgence — ${order.itemLabel} (${order.orderNumber})`,
          createdById: doctor.actor.id,
        },
      }),
    ).rejects.toThrow(/urgence/i);

    // Rolled back: the exam was NOT started, and no debt leaked.
    const after = await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("requested");
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId: enc.id } })).toBe(0);
  });

  it("(2) once an emergency dispense couples the debt, the encounter cannot be un-flagged while it is outstanding", async () => {
    const { reception, encounterId } = await emergencyEncounter();
    const presc = await sendPrescription(encounterId);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id); // emergency bypass → couples placeholder debt in-tx
    expect(
      await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId, status: "outstanding" } }),
    ).toBe(1);

    // Un-flag is refused while the coupled debt is outstanding → "isEmergency=false WITH outstanding
    // debt" can never hold. (The accrual + the un-flag serialise on the encounter row write-lock.)
    await expect(
      flagEncounterEmergency(reception.actor, reception.ctx, encounterId, false),
    ).rejects.toThrow(/dette/i);
    const enc = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    expect(enc.isEmergency).toBe(true);
    expect(
      await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId, status: "outstanding" } }),
    ).toBe(1);
  });

  it("(3) retry does not create a duplicate debt — accrual is idempotent by source within the transaction", async () => {
    const { encounterId } = await emergencyEncounter();
    const enc = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    const data = {
      hospitalId: HRB,
      encounterId,
      patientId: enc.patientId,
      amount: 0,
      source: "Délivrance d'urgence (ordonnance TEST-IDEMP) — montant à définir à la caisse",
      createdById: null,
    };
    const first = await prisma.$transaction((tx) => accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource: true }));
    const second = await prisma.$transaction((tx) => accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource: true }));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.debt.id).toBe(first.debt.id);
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId } })).toBe(1);
  });

  it("(4) a retried emergency dispense and a retried emergency lab start are safely guarded (no duplicate debt)", async () => {
    const { encounterId } = await emergencyEncounter();

    // Pharmacy: dispense once couples the placeholder; the status guard refuses a second dispense → ONE debt.
    const presc = await sendPrescription(encounterId);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id);
    await expect(dispensePrescription(pharm.actor, pharm.ctx, presc.id)).rejects.toThrow();
    expect(
      await prisma.emergencyDebt.count({
        where: { hospitalId: HRB, encounterId, source: { contains: presc.prescriptionNumber } },
      }),
    ).toBe(1);

    // Lab: start once accrues the priced debt; the status guard refuses a second start → ONE debt.
    const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: item.id });
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, order.id);
    await expect(startDiagnostic(tech.actor, tech.ctx, order.id)).rejects.toThrow();
    expect(
      await prisma.emergencyDebt.count({
        where: { hospitalId: HRB, encounterId, source: { contains: order.orderNumber } },
      }),
    ).toBe(1);
  });

  it("(5) eligibility is re-derived inside the tx — a payment that lands before the start accrues NO spurious debt on a now-paid exam", async () => {
    // Review regression (stale-read): the service builds the emergency-debt payload from a pre-tx read.
    // If payment is confirmed in the window, the in-tx isPaid re-check (under the claimed row lock) must
    // skip the accrual so a PAID exam is never coupled to a fresh outstanding debt.
    const { encounterId } = await emergencyEncounter();
    const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId, catalogueItemId: item.id });
    // Payment lands first (status → payment_confirmed, isPaid=true).
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, order.id);

    // The (now stale) emergency-debt payload reaches the tx anyway — it must be ignored because the exam is paid.
    const result = await startDiagnosticTx({
      hospitalId: HRB,
      id: order.id,
      emergencyDebt: {
        hospitalId: HRB,
        encounterId,
        patientId: order.patientId,
        amount: item.price,
        source: `Examen d'urgence — ${order.itemLabel} (${order.orderNumber})`,
        createdById: doctor.actor.id,
      },
    });
    expect(result.order?.status).toBe("in_progress"); // the start still succeeds (paid)
    expect(result.emergencyDebt).toBeNull(); // …but NO debt was coupled to the paid exam
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId } })).toBe(0);
  });

  it("(6) a SETTLED placeholder is not live coverage — a later round accrues a fresh outstanding debt", async () => {
    // Review regression (status-less dedup): idempotency must reuse only an OUTSTANDING debt. Once the
    // round-1 placeholder is settled/waived, a later round with the same source must create a NEW
    // outstanding debt, else goods leave with zero outstanding debt and the discharge gate misses it.
    const { encounterId } = await emergencyEncounter();
    const enc = await prisma.encounter.findUniqueOrThrow({ where: { id: encounterId } });
    const data = {
      hospitalId: HRB,
      encounterId,
      patientId: enc.patientId,
      amount: 0,
      source: "Délivrance d'urgence (ordonnance TEST-ROUND) — montant à définir à la caisse",
      createdById: null,
    };
    const first = await prisma.$transaction((tx) => accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource: true }));
    expect(first.created).toBe(true);
    // The cashier prices + settles the round-1 placeholder.
    await prisma.emergencyDebt.update({ where: { id: first.debt.id }, data: { status: "settled" } });
    // A later round of the SAME prescription re-accrues — it must NOT reuse the settled row.
    const second = await prisma.$transaction((tx) => accrueEmergencyDebtWithinTx(tx, data, { idempotentBySource: true }));
    expect(second.created).toBe(true);
    expect(second.debt.id).not.toBe(first.debt.id);
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId } })).toBe(2);
    expect(await prisma.emergencyDebt.count({ where: { hospitalId: HRB, encounterId, status: "outstanding" } })).toBe(1);
  });
});
