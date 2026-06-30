import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  cancelPrescription,
  createPatientForActor,
  createPrescription,
  finalizePrescription,
  listPrescriptionReservations,
  openEncounter,
  releaseStaleReservations,
  sendPrescriptionToPharmacy,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function paraMedId() {
  const med = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-PARA-500" } });
  return med!.id;
}

/** Create + finalize + send a Paracétamol prescription for `qty`; returns the prescription. */
async function sentPrescription(qty: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "STOCK",
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
    items: [
      {
        medicationId: await paraMedId(),
        dosage: "1 cp",
        frequency: "3x/j",
        duration: "5j",
        quantity: qty,
      },
    ],
  });
  await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
  await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
  return { doctor, presc };
}

async function paraBatch(batchNumber: string) {
  return prisma.medicationStockBatch.findFirst({ where: { hospitalId: HRB, batchNumber } });
}

describe("integration: Phase 2D-4 — stock reservation", () => {
  beforeEach(resetTestDb);

  it("sending a prescription reserves FEFO (earliest expiry first), no on-hand deduction", async () => {
    const { doctor, presc } = await sentPrescription(15);
    // Earliest-expiry Paracétamol lot is LOT-PARA-B (2026-12-31).
    const early = await paraBatch("LOT-PARA-B");
    const late = await paraBatch("LOT-PARA-A");
    expect(early!.quantityReserved).toBe(15);
    expect(early!.quantityOnHand).toBe(200); // NOT deducted
    expect(late!.quantityReserved).toBe(0);

    const reservations = await listPrescriptionReservations(doctor.actor, doctor.ctx, presc.id);
    expect(reservations).toHaveLength(1);
    expect(reservations[0].batch.batchNumber).toBe("LOT-PARA-B");
    expect(reservations[0].quantity).toBe(15);
    expect(reservations[0].status).toBe("active");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "reservation.created", entityId: presc.id },
    });
    expect(audit?.summary).toContain(presc.prescriptionNumber);
  });

  it("spills over to the next FEFO lot and reports a shortfall when stock is insufficient", async () => {
    const { presc } = await sentPrescription(800); // total seeded Paracétamol on-hand = 700
    const early = await paraBatch("LOT-PARA-B");
    const late = await paraBatch("LOT-PARA-A");
    expect(early!.quantityReserved).toBe(200);
    expect(late!.quantityReserved).toBe(500);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "reservation.created", entityId: presc.id },
    });
    expect(audit?.summary).toContain("rupture"); // 100-unit shortfall reported
  });

  it("cancelling a prescription releases its reservations back to the shelf", async () => {
    const { doctor, presc } = await sentPrescription(40);
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(40);
    await cancelPrescription(doctor.actor, doctor.ctx, presc.id);
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(0);
    const reservations = await listPrescriptionReservations(doctor.actor, doctor.ctx, presc.id);
    expect(reservations.every((r) => r.status === "released")).toBe(true);
  });

  it("the 48h sweep releases stale reservations (deterministic)", async () => {
    const { presc } = await sentPrescription(25);
    // Backdate the reservation to 49h ago.
    await prisma.stockReservation.updateMany({
      where: { prescriptionId: presc.id },
      data: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) },
    });
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const result = await releaseStaleReservations(pharm.actor, pharm.ctx);
    expect(result.count).toBe(1);
    expect(result.released).toBe(25);
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(0);
  });

  it("a recent reservation is NOT swept (under 48h)", async () => {
    await sentPrescription(10);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const result = await releaseStaleReservations(pharm.actor, pharm.ctx);
    expect(result.count).toBe(0);
    expect((await paraBatch("LOT-PARA-B"))!.quantityReserved).toBe(10);
  });

  it("RBAC: the doctor cannot run the 48h release sweep", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(releaseStaleReservations(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
