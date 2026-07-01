import { beforeEach, describe, expect, it } from "vitest";

import {
  prisma,
  listDepartments,
  listServiceUnits,
  getSetting,
  listTariffs,
  findTariffByCode,
  createPatientIdentifier,
  findPatientIdentifier,
  createDuplicateCandidate,
  listDuplicateCandidates,
  createObservation,
  listObservations,
  createDiagnosis,
  listDiagnoses,
} from "@/server/db";
import {
  createInvoice,
  createPatientForActor,
  openEncounter,
  recordConsultation,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

/**
 * Phase 1 (Gate 2) data-model foundation — schema/seed/scoping integration tests.
 * Confirms: config/tariff base seed; hospital-scoping of the new models; the InvoiceItem
 * snapshot survives tariff changes; PatientIdentifier is hospital-local (no MPI); the
 * duplicate candidate is warning-only (no merge); structured clinical rows coexist with
 * the kept free-text fields; and the Phase 0 base data is intact. Fake data only.
 */
describe("integration: Phase 1 (Gate 2) data-model foundation", () => {
  beforeEach(resetTestDb);

  it("seeds fake config + tariff base data for HRB-DEMO and keeps Phase 0 base intact", async () => {
    expect((await listDepartments(HRB)).length).toBeGreaterThanOrEqual(3);
    expect((await listServiceUnits(HRB)).length).toBeGreaterThanOrEqual(2);
    expect(await getSetting(HRB, "locale.default")).toMatchObject({ value: "fr" });

    const tariffs = await listTariffs(HRB);
    expect(tariffs).toHaveLength(9); // 5 base + Phase 2G: 4 daily ward-fee tariffs
    expect(tariffs.every((t) => Number.isInteger(t.amount))).toBe(true); // integer FCFA

    // Phase 0 base unchanged.
    expect(await prisma.hospital.count()).toBe(8);
    expect(await prisma.user.count()).toBe(10); // +2 pharmacy, +2 diagnostics, +1 central supervisor (3B)
  });

  it("new config/tariff models are hospital-scoped — no cross-hospital leakage", async () => {
    expect((await listTariffs(HRB)).length).toBe(9); // Phase 2G: +4 daily ward-fee tariffs
    expect((await listTariffs(OTHER)).length).toBe(0);
    expect((await listDepartments(OTHER)).length).toBe(0);
  });

  it("InvoiceItem snapshot is preserved and unaffected by later tariff changes", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(rec, rctx, {
      familyName: "TARIF",
      givenName: "Test",
      sex: "female",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(rec, rctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "test",
    });

    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    const tariff = await findTariffByCode(HRB, "pansement"); // 1500 FCFA
    const invoice = await createInvoice(cai, cctx, enc.id, [
      { label: tariff!.label, unitAmount: tariff!.amount, quantity: 1 },
    ]);
    // Link the line to the tariff as an OPTIONAL source — the snapshot is already stored.
    await prisma.invoiceItem.updateMany({
      where: { invoiceId: invoice.id },
      data: { tariffId: tariff!.id },
    });

    // Change the tariff price AFTER billing.
    await prisma.tariff.update({ where: { id: tariff!.id }, data: { amount: 9999 } });

    const item = await prisma.invoiceItem.findFirstOrThrow({
      where: { invoiceId: invoice.id },
    });
    expect(item.unitAmount).toBe(1500); // snapshot — not 9999
    expect(item.lineTotal).toBe(1500);
    expect(item.tariffId).toBe(tariff!.id);
  });

  it("PatientIdentifier uniqueness is hospital-LOCAL — no national MPI / global de-dup", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const p1 = await createPatientForActor(actor, ctx, {
      familyName: "IDENT",
      givenName: "One",
      sex: "male",
      dateOfBirth: new Date("1985-05-05"),
      phone: null,
      residence: null,
    });
    // A patient with the SAME identifier value in ANOTHER hospital.
    const p2 = await prisma.patient.create({
      data: {
        hospitalId: OTHER,
        patientNumber: "OTHER-P-1",
        familyName: "IDENT",
        givenName: "Two",
        sex: "male",
        dateOfBirth: new Date("1985-05-05"),
      },
    });

    await createPatientIdentifier({
      hospitalId: HRB,
      patientId: p1.id,
      identifierType: "carte_hospitaliere",
      value: "X-123",
    });
    // SAME (type, value) in another hospital must be ALLOWED → no global uniqueness/MPI.
    await expect(
      createPatientIdentifier({
        hospitalId: OTHER,
        patientId: p2.id,
        identifierType: "carte_hospitaliere",
        value: "X-123",
      }),
    ).resolves.toBeTruthy();

    expect(await findPatientIdentifier(HRB, "carte_hospitaliere", "X-123")).toMatchObject({
      patientId: p1.id,
    });
    expect(await findPatientIdentifier(OTHER, "carte_hospitaliere", "X-123")).toMatchObject({
      patientId: p2.id,
    });
  });

  it("PatientDuplicateCandidate is warning/review only — patients are not merged", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const a = await createPatientForActor(actor, ctx, {
      familyName: "DUP",
      givenName: "A",
      sex: "female",
      dateOfBirth: new Date("1992-02-02"),
      phone: "+237 6 00 00 00 01",
      residence: null,
    });
    const b = await createPatientForActor(actor, ctx, {
      familyName: "DUP",
      givenName: "A",
      sex: "female",
      dateOfBirth: new Date("1992-02-02"),
      phone: "+237 6 00 00 00 01",
      residence: null,
    });

    await createDuplicateCandidate({
      hospitalId: HRB,
      patientId: a.id,
      candidatePatientId: b.id,
      matchBasis: "name+dob+phone",
    });

    const candidates = await listDuplicateCandidates(HRB);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe("open"); // review state only
    // Both patients still exist independently — no merge / survivorship.
    expect(
      await prisma.patient.count({ where: { hospitalId: HRB, familyName: "DUP" } }),
    ).toBe(2);
  });

  it("structured clinical rows coexist with the kept free-text fields and are scoped", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(rec, rctx, {
      familyName: "CLIN",
      givenName: "Test",
      sex: "male",
      dateOfBirth: new Date("1980-08-08"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(rec, rctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "fièvre",
    });
    const { actor: doc, ctx: dctx } = await loginAndSelect(ACCOUNTS.doctor);
    await recordConsultation(doc, dctx, enc.id, {
      reason: "fièvre",
      clinicalNote: "note",
      vitals: "T 38,2 °C",
      provisionalDiagnosis: "syndrome fébrile",
      recommendation: "repos",
    });

    const consult = await prisma.consultation.findFirstOrThrow({
      where: { encounterId: enc.id },
    });
    // Free-text fields are KEPT.
    expect(consult.vitals).toBe("T 38,2 °C");
    expect(consult.provisionalDiagnosis).toBe("syndrome fébrile");

    // Structured rows attach and are hospital-scoped.
    await createObservation({
      hospitalId: HRB,
      consultationId: consult.id,
      type: "temperature",
      value: "38.2",
      unit: "°C",
    });
    await createDiagnosis({
      hospitalId: HRB,
      consultationId: consult.id,
      label: "Syndrome fébrile",
      code: "R50.9",
      isPrimary: true,
    });
    expect(await listObservations(HRB, consult.id)).toHaveLength(1);
    expect(await listDiagnoses(HRB, consult.id)).toHaveLength(1);
    expect(await listObservations(OTHER, consult.id)).toHaveLength(0); // no leakage
  });
});
