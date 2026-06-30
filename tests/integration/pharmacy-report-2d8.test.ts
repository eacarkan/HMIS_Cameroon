import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmPrescriptionPayment,
  createPatientForActor,
  createPrescription,
  dispensePrescription,
  finalizePrescription,
  getPharmacyReport,
  openEncounter,
  sendPrescriptionToPharmacy,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function medId(code: string) {
  const m = await prisma.medication.findFirst({ where: { hospitalId: HRB, code } });
  return m!.id;
}

describe("integration: Phase 2D-8 — pharmacy reporting (read-only)", () => {
  beforeEach(resetTestDb);

  it("reports per-medication stock levels and flags low stock", async () => {
    // Métronidazole has no seeded stock — give it a small lot so it falls under the low threshold.
    await prisma.medicationStockBatch.create({
      data: {
        hospitalId: HRB,
        medicationId: await medId("MED-METRO-250"),
        batchNumber: "LOT-METRO-LOW",
        expiryDate: new Date("2027-12-31"),
        quantityReceived: 30,
        quantityOnHand: 30,
        quantityReserved: 0,
      },
    });
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const report = await getPharmacyReport(pharm.actor, pharm.ctx);

    const para = report.stockLevels.find((r) => r.code === "MED-PARA-500");
    expect(para).toBeTruthy();
    expect(para!.totalOnHand).toBe(700); // 200 + 500 seeded
    expect(para!.low).toBe(false);

    const metro = report.lowStock.find((r) => r.code === "MED-METRO-250");
    expect(metro).toBeTruthy();
    expect(metro!.available).toBe(30);
  });

  it("classifies expiring and expired lots (with on-hand), excluding far-future lots", async () => {
    const now = new Date("2026-06-30");
    const para = await medId("MED-PARA-500");
    await prisma.medicationStockBatch.create({
      data: { hospitalId: HRB, medicationId: para, batchNumber: "LOT-SOON", expiryDate: new Date("2026-07-15"), quantityReceived: 10, quantityOnHand: 10, quantityReserved: 0 },
    });
    await prisma.medicationStockBatch.create({
      data: { hospitalId: HRB, medicationId: para, batchNumber: "LOT-OLD", expiryDate: new Date("2025-01-01"), quantityReceived: 20, quantityOnHand: 20, quantityReserved: 0 },
    });

    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const report = await getPharmacyReport(pharm.actor, pharm.ctx, { now });

    const soon = report.expiringLots.find((b) => b.batchNumber === "LOT-SOON");
    const old = report.expiringLots.find((b) => b.batchNumber === "LOT-OLD");
    expect(soon!.status).toBe("expiring");
    expect(old!.status).toBe("expired");
    // The seeded far-future Paracétamol lot (2026-12-31) is NOT flagged.
    expect(report.expiringLots.some((b) => b.batchNumber === "LOT-PARA-A")).toBe(false);
  });

  it("aggregates dispensing volume over the window after a real dispense", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "REPORT",
      givenName: "Test",
      sex: "male",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "x",
    });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const presc = await createPrescription(doctor.actor, doctor.ctx, {
      encounterId: enc.id,
      items: [{ medicationId: await medId("MED-PARA-500"), dosage: "1 cp", duration: "5j", quantity: 12 }],
    });
    await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
    await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmPrescriptionPayment(cashier.actor, cashier.ctx, presc.id);
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await dispensePrescription(pharm.actor, pharm.ctx, presc.id);

    const report = await getPharmacyReport(pharm.actor, pharm.ctx);
    expect(report.dispensing.recordCount).toBe(1);
    expect(report.dispensing.totalUnits).toBe(12);
    const para = report.dispensing.byMedication.find((r) => r.nameFr === "Paracétamol");
    expect(para!.units).toBe(12);
  });

  it("RBAC: reception cannot read the pharmacy report", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(getPharmacyReport(reception.actor, reception.ctx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
