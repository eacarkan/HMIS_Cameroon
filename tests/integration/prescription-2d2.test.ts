import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  cancelPrescription,
  createPatientForActor,
  createPrescription,
  finalizePrescription,
  getPrescription,
  listActiveMedications,
  listPrescriptionsForEncounter,
  openEncounter,
  sendPrescriptionToPharmacy,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

async function anEncounter() {
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
    reason: "Paludisme simple",
  });
  return encounter;
}

async function aLine(ctx: { hospitalId: string }) {
  const med = await prisma.medication.findFirst({
    where: { hospitalId: ctx.hospitalId, isActive: true },
  });
  return {
    medicationId: med!.id,
    dosage: "1 comprimé",
    frequency: "3x/jour",
    duration: "5 jours",
    quantity: 15,
    instructions: "après les repas",
  };
}

describe("integration: Phase 2D-2 — structured prescription", () => {
  beforeEach(resetTestDb);

  it("doctor creates a numbered prescription (snapshot label, draft, audited)", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const line = await aLine(doctor.ctx);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      notes: "Repos",
      items: [line],
    });
    expect(presc.prescriptionNumber).toBe("HRB-DEMO-O-2026-000001");
    expect(presc.status).toBe("draft");
    expect(presc.items).toHaveLength(1);
    // The medication label is a SNAPSHOT (non-empty) captured at prescribe time.
    const med = await prisma.medication.findUnique({ where: { id: line.medicationId } });
    expect(presc.items[0].medicationLabel).toContain(med!.nameFr);
    expect(presc.items[0].unit).toBe(med!.unit);
    expect(presc.items[0].quantity).toBe(15);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "prescription.created", entityId: presc.id },
    });
    expect(audit?.summary).toContain("HRB-DEMO-O-2026-000001");
  });

  it("lifecycle: draft → finalized → sent_to_pharmacy (audited); invalid transitions rejected", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      items: [await aLine(doctor.ctx)],
    });

    // Cannot skip finalize.
    await expect(
      sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id),
    ).rejects.toThrow(/invalide/);

    const finalized = await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
    expect(finalized!.status).toBe("finalized");
    const sent = await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
    expect(sent!.status).toBe("sent_to_pharmacy");

    // Re-finalizing a sent prescription is invalid.
    await expect(finalizePrescription(doctor.actor, doctor.ctx, presc.id)).rejects.toThrow(/invalide/);

    expect(
      await prisma.auditLog.count({ where: { action: "prescription.sent_to_pharmacy", entityId: presc.id } }),
    ).toBe(1);
  });

  it("can be cancelled from draft", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      items: [await aLine(doctor.ctx)],
    });
    const cancelled = await cancelPrescription(doctor.actor, doctor.ctx, presc.id);
    expect(cancelled!.status).toBe("cancelled");
    await expect(finalizePrescription(doctor.actor, doctor.ctx, presc.id)).rejects.toThrow(/invalide/);
  });

  it("rejects an invalid line (bad quantity) and an unknown medication", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const line = await aLine(doctor.ctx);
    await expect(
      createPrescription(doctor.actor, doctor.ctx, { encounterId: enc.id, items: [{ ...line, quantity: 0 }] }),
    ).rejects.toThrow(/quantité/);
    await expect(
      createPrescription(doctor.actor, doctor.ctx, {
        encounterId: enc.id,
        items: [{ ...line, medicationId: "does-not-exist" }],
      }),
    ).rejects.toThrow(/introuvable ou inactif/);
  });

  it("RBAC: reception cannot prescribe; pharmacist reads but cannot prescribe", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      items: [await aLine(doctor.ctx)],
    });

    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      createPrescription(reception.actor, reception.ctx, { encounterId: enc.id, items: [await aLine(reception.ctx)] }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const pharmacist = await loginAndSelect(ACCOUNTS.pharmacist);
    // Pharmacist can READ (for dispensing later) but cannot create.
    const read = await getPrescription(pharmacist.actor, pharmacist.ctx, presc.id);
    expect(read!.id).toBe(presc.id);
    await expect(
      createPrescription(pharmacist.actor, pharmacist.ctx, { encounterId: enc.id, items: [await aLine(pharmacist.ctx)] }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("lists prescriptions for the encounter (hospital-scoped)", async () => {
    const enc = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await createPrescription(doctor.actor, doctor.ctx, { encounterId: enc.id, items: [await aLine(doctor.ctx)] });
    const list = await listPrescriptionsForEncounter(doctor.actor, doctor.ctx, enc.id);
    expect(list).toHaveLength(1);
    expect(list[0].encounterId).toBe(enc.id);
  });

  it("the active-medications list backs the editor", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const meds = await listActiveMedications(doctor.actor, doctor.ctx);
    expect(meds.length).toBeGreaterThan(0);
  });
});
