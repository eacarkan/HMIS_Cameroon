import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  approveStockAdjustment,
  createPatientForActor,
  createPrescription,
  finalizePrescription,
  openEncounter,
  rejectStockAdjustment,
  requestStockAdjustment,
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

/** Reserve `qty` of Paracétamol against LOT-PARA-B by sending a prescription. */
async function reservePara(qty: number) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "ADJ",
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
    items: [{ medicationId: await paraMedId(), dosage: "1 cp", duration: "5j", quantity: qty }],
  });
  await finalizePrescription(doctor.actor, doctor.ctx, presc.id);
  await sendPrescriptionToPharmacy(doctor.actor, doctor.ctx, presc.id);
}

describe("integration: Phase 2D-7 — stock adjustments (dual validation)", () => {
  beforeEach(resetTestDb);

  it("request (increase) → chief approves → on-hand goes UP, audited", async () => {
    const batch = await paraBatch("LOT-PARA-B"); // 200 on-hand
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "increase",
      quantity: 30,
      reason: "Comptage physique supérieur",
    });
    expect(adj.status).toBe("requested");

    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await approveStockAdjustment(chief.actor, chief.ctx, adj.id, "Vérifié");

    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(230); // 200 + 30
    const reloaded = await prisma.stockAdjustment.findUnique({ where: { id: adj.id } });
    expect(reloaded!.status).toBe("approved");
    expect(reloaded!.decidedById).toBe(chief.actor.id);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "stock.adjustment_approved", entityId: adj.id },
    });
    expect(audit?.summary).toContain("LOT-PARA-B");
  });

  it("request (loss) → chief approves → on-hand goes DOWN", async () => {
    const batch = await paraBatch("LOT-PARA-B");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "loss",
      quantity: 25,
      reason: "Casse au comptoir",
    });
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await approveStockAdjustment(chief.actor, chief.ctx, adj.id);
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(175); // 200 − 25
  });

  it("reject → NO stock change, status rejected, audited", async () => {
    const batch = await paraBatch("LOT-PARA-B");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "decrease",
      quantity: 50,
      reason: "Erreur de saisie supposée",
    });
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await rejectStockAdjustment(chief.actor, chief.ctx, adj.id, "Comptage correct, demande infondée");
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(200); // unchanged
    const reloaded = await prisma.stockAdjustment.findUnique({ where: { id: adj.id } });
    expect(reloaded!.status).toBe("rejected");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "stock.adjustment_rejected", entityId: adj.id },
    });
    expect(audit).not.toBeNull();
  });

  it("a reducing adjustment cannot exceed AVAILABLE (reserved units are protected)", async () => {
    await reservePara(150); // LOT-PARA-B: on-hand 200, reserved 150 → available 50
    const batch = await paraBatch("LOT-PARA-B");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    await expect(
      requestStockAdjustment(pharm.actor, pharm.ctx, {
        batchId: batch!.id,
        type: "decrease",
        quantity: 100, // > available 50
        reason: "trop",
      }),
    ).rejects.toThrow(/disponible insuffisant/);
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(200);
  });

  it("expired-stock removal: request `expiry` on an expired lot → approve → on-hand reduced", async () => {
    const expired = await prisma.medicationStockBatch.create({
      data: {
        hospitalId: HRB,
        medicationId: await paraMedId(),
        batchNumber: "LOT-PARA-EXP",
        expiryDate: new Date("2025-01-01"),
        quantityReceived: 40,
        quantityOnHand: 40,
        quantityReserved: 0,
      },
    });
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: expired.id,
      type: "expiry",
      quantity: 40,
      reason: "Lot périmé — destruction",
    });
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await approveStockAdjustment(chief.actor, chief.ctx, adj.id);
    expect((await prisma.medicationStockBatch.findUnique({ where: { id: expired.id } }))!.quantityOnHand).toBe(0);
  });

  it("re-checks AVAILABLE at APPROVAL time: a reservation made after the request blocks approval (and rolls back)", async () => {
    const batch = await paraBatch("LOT-PARA-B"); // 200 on-hand, 0 reserved
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "loss",
      quantity: 180, // available 200 at request time → allowed
      reason: "demande initiale",
    });
    // A new prescription now reserves 100 → available drops to 100 (< 180).
    await reservePara(100);
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await expect(approveStockAdjustment(chief.actor, chief.ctx, adj.id)).rejects.toThrow(
      /disponible insuffisant/,
    );
    // The whole approval rolled back: stock unchanged, adjustment still `requested`.
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(200);
    const reloaded = await prisma.stockAdjustment.findUnique({ where: { id: adj.id } });
    expect(reloaded!.status).toBe("requested");
  });

  it("a decided adjustment cannot be decided again", async () => {
    const batch = await paraBatch("LOT-PARA-B");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "increase",
      quantity: 10,
      reason: "double décision",
    });
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await approveStockAdjustment(chief.actor, chief.ctx, adj.id);
    await expect(approveStockAdjustment(chief.actor, chief.ctx, adj.id)).rejects.toThrow(/déjà été traité/);
    await expect(rejectStockAdjustment(chief.actor, chief.ctx, adj.id, "x")).rejects.toThrow(/déjà été traité/);
    expect((await paraBatch("LOT-PARA-B"))!.quantityOnHand).toBe(210); // applied once only
  });

  it("RBAC: the pharmacist cannot approve; the chief cannot request; reception cannot request", async () => {
    const batch = await paraBatch("LOT-PARA-B");
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const adj = await requestStockAdjustment(pharm.actor, pharm.ctx, {
      batchId: batch!.id,
      type: "loss",
      quantity: 5,
      reason: "rbac",
    });
    // Requester cannot self-approve.
    await expect(approveStockAdjustment(pharm.actor, pharm.ctx, adj.id)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    // The chief cannot request.
    const chief = await loginAndSelect(ACCOUNTS.pharmacistChief);
    await expect(
      requestStockAdjustment(chief.actor, chief.ctx, {
        batchId: batch!.id,
        type: "loss",
        quantity: 5,
        reason: "chef ne demande pas",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    // Reception is not in the stock flow at all.
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      requestStockAdjustment(reception.actor, reception.ctx, {
        batchId: batch!.id,
        type: "loss",
        quantity: 5,
        reason: "non",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
