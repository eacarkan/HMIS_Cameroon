import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  accrueEmergencyDebt,
  assignWard,
  authorizeDischarge,
  cancelAdmission,
  createPatientForActor,
  flagEncounterEmergency,
  generateDailyWardCharge,
  getAdmissionForEncounter,
  openEncounter,
  recordPayment,
  requestAdmission,
  requestDischarge,
  settleEmergencyDebt,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function wardId(code = "SRV-MED-INTERNE") {
  const w = await prisma.serviceUnit.findFirst({ where: { hospitalId: HRB, code } });
  return w!.id;
}

/** Open an encounter (optionally emergency) and request an admission on it (doctor). */
async function encounterWithAdmissionRequest(opts?: { emergency?: boolean }) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "HOSPIT",
    givenName: "Test",
    sex: "male",
    dateOfBirth: new Date("1985-01-01"),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Bilan",
  });
  if (opts?.emergency) {
    await flagEncounterEmergency(reception.actor, reception.ctx, enc.id, true);
  }
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const admission = await requestAdmission(doctor.actor, doctor.ctx, enc.id, {
    reason: "Surveillance 48h",
  });
  return { encounterId: enc.id, admissionId: admission.id, patientId: patient.id };
}

/** Request → assign ward (admitted), returning the actors + ids. */
async function admittedAdmission() {
  const { encounterId, admissionId } = await encounterWithAdmissionRequest();
  const reception = await loginAndSelect(ACCOUNTS.reception);
  await assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: await wardId() });
  return { encounterId, admissionId };
}

describe("integration: Phase 2G — ward-level hospitalization", () => {
  beforeEach(resetTestDb);

  it("request → assign ward (snapshots the ward tariff) → daily fee → pay → discharge", async () => {
    const { admissionId } = await encounterWithAdmissionRequest();

    // Assign the Internal Medicine ward — the daily fee is snapshot from tariff SRV-MED-INTERNE (10 000).
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const admitted = await assignWard(reception.actor, reception.ctx, admissionId, {
      wardServiceUnitId: await wardId("SRV-MED-INTERNE"),
    });
    expect(admitted!.status).toBe("admitted");
    expect(admitted!.dailyWardFee).toBe(10000);

    // The cashier generates today's ward fee → lazily creates the hospitalization invoice.
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const charge = await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId);
    expect(charge.created).toBe(true);
    expect(charge.amount).toBe(10000);
    const invoice = await prisma.invoice.findUnique({ where: { id: charge.invoiceId }, include: { items: true } });
    expect(invoice!.totalAmount).toBe(10000);
    expect(invoice!.items).toHaveLength(1);
    expect(invoice!.invoiceNumber).toMatch(/HRB-DEMO-F-2026-/);

    // Discharge is BLOCKED while the hospitalization invoice is unpaid.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await requestDischarge(doctor.actor, doctor.ctx, admissionId);
    await expect(authorizeDischarge(doctor.actor, doctor.ctx, admissionId)).rejects.toThrow(
      /facture non réglée/,
    );

    // Pay the invoice, then discharge succeeds.
    await recordPayment(cashier.actor, cashier.ctx, charge.invoiceId, { amount: 10000, method: "cash" });
    const discharged = await authorizeDischarge(doctor.actor, doctor.ctx, admissionId);
    expect(discharged!.status).toBe("discharged");

    const audit = await prisma.auditLog.findFirst({ where: { action: "admission.discharged", entityId: admissionId } });
    expect(audit).not.toBeNull();
  });

  it("daily fee is IDEMPOTENT per day, and accrues per distinct day", async () => {
    const { admissionId } = await admittedAdmission();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);

    const day1 = new Date("2026-06-30T09:00:00.000Z");
    const first = await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, day1);
    const second = await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, day1);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false); // same day → no double-bill

    // A different day adds a second charge.
    await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, new Date("2026-07-01T09:00:00.000Z"));

    const charges = await prisma.admissionDailyCharge.count({ where: { admissionId } });
    expect(charges).toBe(2);
    const invoice = await prisma.invoice.findUnique({ where: { id: first.invoiceId } });
    expect(invoice!.totalAmount).toBe(20000); // 2 × 10 000
  });

  it("concurrent same-day charges never double-bill (row-lock + unique idempotency)", async () => {
    const { admissionId } = await admittedAdmission();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const day = new Date("2026-06-30T12:00:00.000Z");
    await Promise.allSettled([
      generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, day),
      generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, day),
    ]);
    const charges = await prisma.admissionDailyCharge.count({ where: { admissionId } });
    expect(charges).toBe(1);
    const adm = await prisma.admission.findUnique({ where: { id: admissionId } });
    const invoice = await prisma.invoice.findUnique({ where: { id: adm!.invoiceId! } });
    expect(invoice!.totalAmount).toBe(10000);
  });

  it("a ward must be an active INPATIENT_WARD service; an outpatient service is rejected", async () => {
    const { admissionId } = await encounterWithAdmissionRequest();
    const outpatient = await prisma.serviceUnit.findFirst({
      where: { hospitalId: HRB, type: "OUTPATIENT", isActive: true },
    });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: outpatient!.id }),
    ).rejects.toThrow(/Service d'hospitalisation invalide/);
  });

  it("assignment is refused when the ward has no active daily tariff configured", async () => {
    const { admissionId } = await encounterWithAdmissionRequest();
    // A ward with no matching tariff.
    const ward = await prisma.serviceUnit.create({
      data: {
        hospitalId: HRB,
        code: "SRV-WARD-NOFEE",
        name: "Aile sans tarif",
        nameFr: "Aile sans tarif",
        type: "INPATIENT_WARD",
        isInpatientWard: true,
        isActive: true,
      },
    });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: ward.id }),
    ).rejects.toThrow(/Aucun tarif journalier actif/);
  });

  it("RBAC: only a doctor requests/discharges; only the admission desk assigns the ward", async () => {
    const { encounterId, admissionId } = await encounterWithAdmissionRequest();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);

    // Reception cannot request an admission.
    await expect(
      requestAdmission(reception.actor, reception.ctx, encounterId, { reason: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    // Doctor cannot assign a ward.
    await expect(
      assignWard(doctor.actor, doctor.ctx, admissionId, { wardServiceUnitId: await wardId() }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    // After the desk admits, reception cannot authorise discharge (doctor-only).
    await assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: await wardId() });
    await expect(
      authorizeDischarge(reception.actor, reception.ctx, admissionId),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("an admission can be cancelled before a ward is assigned, but not after admission", async () => {
    const { admissionId } = await encounterWithAdmissionRequest();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const cancelled = await cancelAdmission(doctor.actor, doctor.ctx, admissionId, "Patient parti");
    expect(cancelled!.status).toBe("cancelled");
    // A cancelled admission cannot then be assigned a ward.
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: await wardId() }),
    ).rejects.toThrow(/déjà été traitée|demande/);
  });

  it("a second concurrent ward assignment loses (guarded transition)", async () => {
    const { admissionId } = await encounterWithAdmissionRequest();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const ward = await wardId();
    const results = await Promise.allSettled([
      assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: ward }),
      assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: ward }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(1);
    const adm = await prisma.admission.findUnique({ where: { id: admissionId } });
    expect(adm!.status).toBe("admitted");
  });

  it("only one active admission per encounter", async () => {
    const { encounterId } = await admittedAdmission();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(
      requestAdmission(doctor.actor, doctor.ctx, encounterId, { reason: "doublon" }),
    ).rejects.toThrow(/déjà en cours/);
  });

  it("discharge is BLOCKED by outstanding emergency debt (2H linkage) and clears once settled", async () => {
    const { encounterId, admissionId } = await encounterWithAdmissionRequest({ emergency: true });
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await assignWard(reception.actor, reception.ctx, admissionId, { wardServiceUnitId: await wardId() });

    // Cashier accrues an emergency debt + generates + pays the daily ward fee.
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const debt = await accrueEmergencyDebt(cashier.actor, cashier.ctx, {
      encounterId,
      amount: 3000,
      source: "Soins d'urgence",
    });
    const charge = await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId);
    await recordPayment(cashier.actor, cashier.ctx, charge.invoiceId, { amount: charge.amount, method: "cash" });

    // Invoice is paid, but the emergency debt still blocks discharge.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(authorizeDischarge(doctor.actor, doctor.ctx, admissionId)).rejects.toThrow(
      /dette d'urgence en cours/,
    );

    // Settle the debt → discharge succeeds.
    await settleEmergencyDebt(cashier.actor, cashier.ctx, debt.id);
    const discharged = await authorizeDischarge(doctor.actor, doctor.ctx, admissionId);
    expect(discharged!.status).toBe("discharged");
  });

  // Review-hardening (2G §9): concurrent requestAdmission on one encounter must not double-admit.
  it("concurrent admission requests on one encounter create only ONE admission", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "RACE",
      givenName: "Adm",
      sex: "female",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "Bilan",
    });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const results = await Promise.allSettled([
      requestAdmission(doctor.actor, doctor.ctx, enc.id, { reason: "A" }),
      requestAdmission(doctor.actor, doctor.ctx, enc.id, { reason: "B" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBe(1);
    const active = await prisma.admission.count({
      where: { encounterId: enc.id, status: { in: ["requested", "admitted", "discharge_requested"] } },
    });
    expect(active).toBe(1);
  });

  // Review-hardening (2G §9): concurrent FIRST daily charges (distinct days) must not orphan an invoice.
  it("concurrent first daily charges create exactly ONE hospitalization invoice (no orphan)", async () => {
    const { encounterId, admissionId } = await admittedAdmission();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await Promise.allSettled([
      generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, new Date("2026-06-30T08:00:00.000Z")),
      generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId, new Date("2026-07-01T08:00:00.000Z")),
    ]);
    // Exactly one invoice for the encounter; both daily-fee items land on it; no orphan invoice.
    expect(await prisma.invoice.count({ where: { encounterId } })).toBe(1);
    const adm = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { invoice: { include: { items: true } } },
    });
    expect(adm!.invoice!.items).toHaveLength(2);
    expect(adm!.invoice!.totalAmount).toBe(20000);
    // Each daily-fee item links to the ward tariff (audit chain).
    expect(adm!.invoice!.items.every((i) => i.tariffId !== null)).toBe(true);
  });

  it("getAdmissionForEncounter surfaces the live discharge gate", async () => {
    const { encounterId, admissionId } = await admittedAdmission();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await generateDailyWardCharge(cashier.actor, cashier.ctx, admissionId);

    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const view = await getAdmissionForEncounter(doctor.actor, doctor.ctx, encounterId);
    expect(view.admission?.status).toBe("admitted");
    expect(view.dischargeBlock.blocked).toBe(true);
    expect(view.dischargeBlock.reasons.join(" ")).toMatch(/facture non réglée/);
  });
});
