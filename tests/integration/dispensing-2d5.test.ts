import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmPrescriptionPayment,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  getDispenseRecord,
  openEncounter,
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

/** Create → finalize → send a Paracétamol prescription for `qty` (reserves FEFO). */
async function sentPara(qty: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "PHARMA",
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

describe("integration: Phase 2D-5 — dispensing & stock deduction", () => {
  beforeEach(resetTestDb);

  it("pay → dispense deducts on-hand, clears the reservation, marks the prescription dispensed", async () => {
    const presc = await sentPara(15);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);

    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const record = await dispensePrescription(pharm.actor, pharm.ctx, presc.id);
    expect(record.dispenseNumber).toBe("HRB-DEMO-D-2026-000001");

    const early = await paraBatch("LOT-PARA-B"); // FEFO-reserved lot
    expect(early!.quantityOnHand).toBe(185); // 200 − 15 deducted
    expect(early!.quantityReserved).toBe(0); // reservation released on consume

    const reloaded = await prisma.prescription.findUnique({ where: { id: presc.id } });
    expect(reloaded!.status).toBe("dispensed");
    const reservation = await prisma.stockReservation.findFirst({ where: { prescriptionId: presc.id } });
    expect(reservation!.status).toBe("consumed");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "dispense.completed", entityId: record.id },
    });
    expect(audit?.summary).toContain(presc.prescriptionNumber);
  });

  it("rejects dispensing an UNPAID prescription (the paid check)", async () => {
    const presc = await sentPara(10);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(dispensePrescription(pharm.actor, pharm.ctx, presc.id)).rejects.toThrow(
      /payée à la caisse/,
    );
    // Nothing deducted.
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(200);
  });

  it("partial dispensing: when stock was short, dispenses what was reserved → partially_dispensed", async () => {
    const presc = await sentPara(800); // reserved 700 (200 + 500), shortfall 100
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id);

    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(0); // 200 − 200
    expect((await paraBatch("LOT-PARA-A"))!.quantityOnHand).toBe(0); // 500 − 500
    const reloaded = await prisma.prescription.findUnique({ where: { id: presc.id } });
    expect(reloaded!.status).toBe("partially_dispensed");
  });

  it("RBAC: cashier confirms payment but cannot dispense; pharmacist dispenses but cannot confirm payment", async () => {
    const presc = await sentPara(5);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);

    await expect(dispensePrescription(cashier.actor, cashier.ctx, presc.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    await expect(
      confirmPrescriptionPayment(pharm.actor, pharm.ctx, presc.id),
    ).rejects.toBeInstanceOf(AuthorizationError);

    // The proper actors succeed.
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const record = await dispensePrescription(pharm.actor, pharm.ctx, presc.id);
    const reloaded = await getDispenseRecord(pharm.actor, pharm.ctx, record.id);
    expect(reloaded!.items).toHaveLength(1);
  });

  it("multi-round: a later dispense completing a partial line transitions to dispensed (cumulative)", async () => {
    // Shrink Paracétamol to a single 30-unit lot so a qty-100 prescription reserves only 30.
    await prisma.medicationStockBatch.deleteMany({
      where: { hospitalId: HRB, batchNumber: "LOT-PARA-A" },
    });
    await prisma.medicationStockBatch.updateMany({
      where: { hospitalId: HRB, batchNumber: "LOT-PARA-B" },
      data: { quantityOnHand: 30, quantityReceived: 30 },
    });

    const presc = await sentPara(100); // reserves 30 (shortfall 70)
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id); // dispenses 30
    let reloaded = await prisma.prescription.findUnique({ where: { id: presc.id } });
    expect(reloaded!.status).toBe("partially_dispensed");

    // Restock + simulate re-reservation of the remaining 70 against a new lot (the app re-reserve
    // feature is a later extension; this validates the cumulative-status logic directly).
    const medId = await paraMedId();
    const newBatch = await prisma.medicationStockBatch.create({
      data: {
        hospitalId: HRB,
        medicationId: medId,
        batchNumber: "LOT-PARA-C",
        expiryDate: new Date("2028-01-31"),
        quantityReceived: 100,
        quantityOnHand: 100,
        quantityReserved: 70,
      },
    });
    const item = await prisma.prescriptionItem.findFirst({ where: { prescriptionId: presc.id } });
    await prisma.stockReservation.create({
      data: {
        hospitalId: HRB,
        prescriptionId: presc.id,
        prescriptionItemId: item!.id,
        medicationId: medId,
        batchId: newBatch.id,
        quantity: 70,
        status: "active",
      },
    });

    // Second round: consumes 70 → cumulative 100 → dispensed.
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id);
    reloaded = await prisma.prescription.findUnique({ where: { id: presc.id } });
    expect(reloaded!.status).toBe("dispensed");
    const b = await prisma.medicationStockBatch.findUnique({ where: { id: newBatch.id } });
    expect(b!.quantityOnHand).toBe(30); // 100 − 70
    expect(b!.quantityReserved).toBe(0);
  });

  it("concurrent double-dispense deducts stock ONCE and creates ONE record (atomic + guarded claim)", async () => {
    const presc = await sentPara(15);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);

    // Two pharmacists (or a double-click / retry) dispense the SAME prescription at once.
    const outcomes = await Promise.allSettled([
      dispensePrescription(pharm.actor, pharm.ctx, presc.id),
      dispensePrescription(pharm.actor, pharm.ctx, presc.id),
    ]);
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejected = outcomes.filter((o) => o.status === "rejected");
    // Exactly one wins; the loser is cleanly rejected (no active reservation left to consume).
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Stock deducted exactly once (200 − 15), reservation released once — never doubled / negative.
    const early = await paraBatch("LOT-PARA-B");
    expect(early!.quantityOnHand).toBe(185);
    expect(early!.quantityReserved).toBe(0);

    // Exactly one dispense record exists for the prescription.
    const records = await prisma.dispenseRecord.findMany({ where: { prescriptionId: presc.id } });
    expect(records).toHaveLength(1);

    const reloaded = await prisma.prescription.findUnique({ where: { id: presc.id } });
    expect(reloaded!.status).toBe("dispensed");
  });

  it("a paid but never-reserved prescription cannot be dispensed (no active reservations)", async () => {
    // Send an ACT prescription for more than seeded stock so nothing is reservable beyond stock,
    // then exhaust by a prior dispense — here simpler: a medication with zero stock.
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "NOSTOCK",
      givenName: "Test",
      sex: "female",
      dateOfBirth: new Date("1991-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "x",
    });
    // Dentaire-like med with no stock: use Ibuprofène (seeded catalogue, NO stock batch).
    const ibu = await prisma.medication.findFirst({ where: { hospitalId: HRB, code: "MED-IBU-400" } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      items: [{ medicationId: ibu!.id, dosage: "1 cp", duration: "3j", quantity: 10 }],
    });
    await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
    await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id); // reserves nothing (no stock)
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(dispensePrescription(pharm.actor, pharm.ctx, presc.id)).rejects.toThrow(
      /Aucune réservation active/,
    );
  });
});
