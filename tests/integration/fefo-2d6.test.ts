import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmPrescriptionPayment,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  getReservationOverrideOptions,
  openEncounter,
  overrideReservationBatch,
  sendPrescriptionToPharmacy,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function paraMedId() {
  const m = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
  return m!.id;
}
async function paraBatch(batchNumber: string) {
  return prisma.medicationStockBatch.findFirst({ where: { hospitalId: HRB, batchNumber } });
}

/** Create → finalize → send a Paracétamol prescription for `qty` (reserves the FEFO lot LOT-PARA-B). */
async function sentPara(qty: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "FEFO",
    givenName: "Test",
    sex: "male",
    dateOfBirth: new Date("1990-01-01"),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Paludisme",
  });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const presc = await createPrescription(doctor.actor, doctor.ctx, {
    encounterId: enc.id,
    items: [{ medicationId: await paraMedId(), dosage: "1 cp", duration: "5j", quantity: qty }],
  });
  await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
  await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
  return presc;
}

describe("integration: Phase 2D-6 — FEFO override", () => {
  beforeEach(resetTestDb);

  it("Pharmacist-in-Charge re-points a reservation off the FEFO lot onto a chosen lot (hold moves, audited)", async () => {
    const presc = await sentPara(15); // reserves LOT-PARA-B (earliest expiry = FEFO)
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(15);

    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    const opts = await getReservationOverrideOptions(chief.actor, chief.ctx, presc.id);
    expect(opts).toHaveLength(1);
    expect(opts[0].batch.batchNumber).toBe("LOT-PARA-B");
    expect(opts[0].isCurrentFefo).toBe(true);
    const late = await paraBatch("LOT-PARA-A");
    expect(opts[0].candidates.some((c) => c.id === late!.id)).toBe(true);

    await overrideReservationBatch(chief.actor, chief.ctx, {
      prescriptionId: presc.id,
      reservationId: opts[0].id,
      toBatchId: late!.id,
      reason: "Lot prioritaire physiquement endommagé",
    });

    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(0); // released
    expect((await paraBatch("LOT-PARA-A"))!.quantityReserved).toBe(15); // moved onto the chosen lot
    const reservation = await prisma.stockReservation.findFirst({
      where: { prescriptionId: presc.id, status: "active" },
    });
    expect(reservation!.batchId).toBe(late!.id);
    expect(reservation!.isFefoOverride).toBe(true);
    expect(reservation!.overrideReason).toBe("Lot prioritaire physiquement endommagé");
    expect(reservation!.overrideById).toBe(chief.actor.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "fefo.override", entityId: reservation!.id },
    });
    expect(audit?.summary).toContain("LOT-PARA-A");
    expect(audit?.summary).toContain("LOT-PARA-B");
  });

  it("after an override, dispensing consumes the CHOSEN lot (not the FEFO lot)", async () => {
    const presc = await sentPara(15);
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    const opts = await getReservationOverrideOptions(chief.actor, chief.ctx, presc.id);
    const late = await paraBatch("LOT-PARA-A");
    await overrideReservationBatch(chief.actor, chief.ctx, {
      prescriptionId: presc.id,
      reservationId: opts[0].id,
      toBatchId: late!.id,
      reason: "Raison opérationnelle valable",
    });

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id);

    expect((await paraBatch("LOT-PARA-A"))!.quantityOnHand).toBe(485); // chosen lot: 500 − 15
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(200); // FEFO lot untouched
  });

  it("RBAC: a regular pharmacist cannot override FEFO (chief-only)", async () => {
    const presc = await sentPara(10);
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    const opts = await getReservationOverrideOptions(chief.actor, chief.ctx, presc.id);
    const late = await paraBatch("LOT-PARA-A");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);

    await expect(
      overrideReservationBatch(pharm.actor, pharm.ctx, {
        prescriptionId: presc.id,
        reservationId: opts[0].id,
        toBatchId: late!.id,
        reason: "tentative non autorisée",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(10); // nothing moved
  });

  it("rejects an override to the same lot, a missing reason, and an EXPIRED lot", async () => {
    const presc = await sentPara(10);
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    const opts = await getReservationOverrideOptions(chief.actor, chief.ctx, presc.id);
    const early = await paraBatch("LOT-PARA-B"); // the currently-reserved lot
    const late = await paraBatch("LOT-PARA-A");

    await expect(
      overrideReservationBatch(chief.actor, chief.ctx, {
        prescriptionId: presc.id,
        reservationId: opts[0].id,
        toBatchId: early!.id,
        reason: "motif présent",
      }),
    ).rejects.toThrow(/déjà le lot réservé/);

    await expect(
      overrideReservationBatch(chief.actor, chief.ctx, {
        prescriptionId: presc.id,
        reservationId: opts[0].id,
        toBatchId: late!.id,
        reason: "   ",
      }),
    ).rejects.toThrow(/motif/i);

    // An expired lot is never a valid FEFO-override target (expired stock = the 2D-7 flow).
    const expired = await prisma.medicationStockBatch.create({
      data: {
        hospitalId: HRB,
        medicationId: await paraMedId(),
        batchNumber: "LOT-PARA-EXP",
        expiryDate: new Date("2025-01-01"),
        quantityReceived: 100,
        quantityOnHand: 100,
        quantityReserved: 0,
      },
    });
    await expect(
      overrideReservationBatch(chief.actor, chief.ctx, {
        prescriptionId: presc.id,
        reservationId: opts[0].id,
        toBatchId: expired.id,
        reason: "ne doit pas passer",
      }),
    ).rejects.toThrow(/périmé/);
    // …and it is not even offered as a candidate.
    const opts2 = await getReservationOverrideOptions(chief.actor, chief.ctx, presc.id);
    expect(opts2[0].candidates.some((c) => c.id === expired.id)).toBe(false);
    // The original FEFO reservation is intact after all the rejected attempts.
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(10);
  });

  it("rejects overriding a reservation that belongs to a DIFFERENT prescription (ownership)", async () => {
    const prescA = await sentPara(10);
    const prescB = await sentPara(10);
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    const optsB = await getReservationOverrideOptions(chief.actor, chief.ctx, prescB.id);
    const late = await paraBatch("LOT-PARA-A");

    // Tampered: claim prescription A but pass prescription B's reservation id.
    await expect(
      overrideReservationBatch(chief.actor, chief.ctx, {
        prescriptionId: prescA.id,
        reservationId: optsB[0].id,
        toBatchId: late!.id,
        reason: "réservation d'une autre ordonnance",
      }),
    ).rejects.toThrow(/introuvable pour cette ordonnance/);
  });
});
