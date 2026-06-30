import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  createPatientForActor,
  openEncounter,
  recordConsultation,
  createInvoice,
  // Gate 3 services
  createDepartment,
  listDepartments,
  addPatientContact,
  addPatientIdentifier,
  addObservation,
  addDiagnosis,
  listObservations,
  listTariffs,
  createTariff,
  updateTariff,
  getTariffLineSource,
  flagDuplicateCandidate,
  reviewDuplicateCandidate,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

/**
 * Gate 3 — service-layer RBAC / hospital-scoping / audit for the Gate 2 models.
 * Fake data only. Proves authorized vs denied actions (with `authz.denied` audit),
 * cross-hospital scoping, role boundaries, tariff-snapshot protection and the
 * warning-only duplicate flow. The Phase 0 golden path is verified by smoke/e2e.
 */
describe("integration: Gate 3 service RBAC / scoping / audit", () => {
  beforeEach(resetTestDb);

  it("authorized admin can manage configuration (audited)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const dept = await createDepartment(actor, ctx, { code: "TEST-DEPT", name: "Test" });
    expect(dept.code).toBe("TEST-DEPT");
    expect((await listDepartments(actor, ctx)).some((d) => d.code === "TEST-DEPT")).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "department.create" } })).toBeGreaterThanOrEqual(1);
  });

  it("unauthorized role is denied and authz.denied is audited", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception); // ACC cannot manage config
    await expect(createDepartment(actor, ctx, { code: "X", name: "X" })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
    const denied = await prisma.auditLog.findMany({ where: { action: "authz.denied" } });
    expect(denied.some((d) => d.summary.includes("config.manage"))).toBe(true);
  });

  it("hospital scoping: cannot act on a patient in another hospital (no leakage)", async () => {
    const other = await prisma.patient.create({
      data: {
        hospitalId: OTHER,
        patientNumber: "OTHER-P-1",
        familyName: "X",
        givenName: "Y",
        sex: "male",
        dateOfBirth: new Date("1990-01-01"),
      },
    });
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      addPatientContact(actor, ctx, other.id, { contactType: "phone", value: "x" }),
    ).rejects.toThrow();
  });

  it("reception manages patient contacts/identifiers but cannot manage diagnosis", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(actor, ctx, {
      familyName: "ID",
      givenName: "Test",
      sex: "female",
      dateOfBirth: new Date("1990-03-14"),
      phone: null,
      residence: null,
    });
    expect((await addPatientContact(actor, ctx, patient.id, { contactType: "phone", value: "+237 6 99 00 00 01" })).id).toBeTruthy();
    expect((await addPatientIdentifier(actor, ctx, patient.id, { identifierType: "carte_hospitaliere", value: "A-1" })).id).toBeTruthy();
    // Diagnosis is clinician-only — denied for reception by RBAC.
    await expect(
      addDiagnosis(actor, ctx, "any-consultation-id", { label: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("doctor manages observations/diagnosis but cannot manage tariffs", async () => {
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
    const consult = await prisma.consultation.findFirstOrThrow({ where: { encounterId: enc.id } });

    expect((await addObservation(doc, dctx, consult.id, { type: "temperature", value: "38.2", unit: "°C" })).id).toBeTruthy();
    expect((await addDiagnosis(doc, dctx, consult.id, { label: "Syndrome fébrile", code: "R50.9", isPrimary: true })).id).toBeTruthy();
    expect(await listObservations(doc, dctx, consult.id)).toHaveLength(1);
    // Free-text consultation fields are preserved.
    expect(consult.vitals).toBe("T 38,2 °C");
    // Tariff management is admin-only — denied for doctor.
    await expect(
      createTariff(doc, dctx, { code: "DOC-T", label: "X", amount: 1000 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cashier reads/uses tariffs for billing but cannot mutate them or read clinical data", async () => {
    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    expect((await listTariffs(cai, cctx)).length).toBeGreaterThanOrEqual(5); // read allowed
    const source = await getTariffLineSource(cai, cctx, "pansement"); // tariff.use allowed + audited
    expect(source).toMatchObject({ label: "Pansement", unitAmount: 1500, quantity: 1 });
    expect(await prisma.auditLog.count({ where: { action: "invoice_item.tariff_source_used" } })).toBeGreaterThanOrEqual(1);
    // Cannot mutate tariffs, cannot read clinical structures.
    await expect(createTariff(cai, cctx, { code: "CAI-T", label: "X", amount: 500 })).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listObservations(cai, cctx, "any-consultation-id")).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("tariff update does not change a historical invoice-item snapshot", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(rec, rctx, {
      familyName: "SNAP",
      givenName: "Test",
      sex: "female",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(rec, rctx, patient.id, { serviceLabel: "Médecine générale", reason: "test" });

    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    const line = await getTariffLineSource(cai, cctx, "pansement"); // 1500
    const invoice = await createInvoice(cai, cctx, enc.id, [line]);

    // Admin changes the tariff price AFTER billing.
    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { hospitalId: HRB, code: "pansement" } });
    await updateTariff(adm, actx, tariff.id, { amount: 9999 });

    const item = await prisma.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(item.unitAmount).toBe(1500); // snapshot unchanged
    expect(item.lineTotal).toBe(1500);
  });

  it("duplicate warning/review never merges patients", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const a = await createPatientForActor(actor, ctx, { familyName: "DUP", givenName: "A", sex: "female", dateOfBirth: new Date("1992-02-02"), phone: "+237 6 00 00 00 01", residence: null });
    const b = await createPatientForActor(actor, ctx, { familyName: "DUP", givenName: "A", sex: "female", dateOfBirth: new Date("1992-02-02"), phone: "+237 6 00 00 00 01", residence: null });

    const cand = await flagDuplicateCandidate(actor, ctx, a.id, b.id, "name+dob+phone");
    expect(cand.status).toBe("open");
    const reviewed = await reviewDuplicateCandidate(actor, ctx, cand.id, "dismissed");
    expect(reviewed.status).toBe("dismissed");

    // Both patients still exist independently — no merge/survivorship.
    expect(await prisma.patient.count({ where: { hospitalId: HRB, familyName: "DUP" } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "patient_duplicate.warning" } })).toBeGreaterThanOrEqual(1);
  });

  it("Phase 0 base + Gate 2 config/tariff seed remain intact", async () => {
    expect(await prisma.hospital.count()).toBe(8);
    expect(await prisma.user.count()).toBe(7); // Phase 2D: +2 pharmacy users
    expect(await prisma.tariff.count({ where: { hospitalId: HRB } })).toBe(9); // Phase 2G: +4 daily ward-fee tariffs
  });
});
