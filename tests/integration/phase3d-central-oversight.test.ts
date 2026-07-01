import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  addDiagnosis,
  createInvoice,
  createPatientForActor,
  generateHospitalAggregateSnapshot,
  getCentralOversight,
  openEncounter,
  recordConsultation,
  recordPayment,
  selectHospital,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 3D — Central aggregate oversight (DB-backed). PRIVACY IS THE #1 DIMENSION: the central
 * viewer reads ONLY per-hospital aggregate snapshots — never operational patient-level tables — and
 * no nominative field ever reaches a snapshot or the central view. Snapshots are generated hospital-
 * side (gated by report.operational.read); central read is gated by the global central.aggregate.view
 * and audited. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const CENTRAL = "direction.regionale@hrb-demo.cm";

const SECRET_NAME = "ZZZSECRETPATIENT";

const ALLOWED_INDICATOR_KEYS = [
  "period", "periodLabel", "consultationCount", "patientCount", "queueTicketCount", "admissionCount",
  "diagnosticOrderCount", "revenueTotalFcfa", "revenueByMethod", "topDiagnoses", "emergencyDebtOutstandingFcfa",
  "pharmacy",
].sort();

describe("integration: Phase 3D central aggregate oversight (snapshot-fed)", () => {
  beforeEach(resetTestDb);

  it("a hospital generates an aggregate-only snapshot (no patient identifiers), audited", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    // Operational activity with a DISTINCTIVE patient name + a payment.
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: SECRET_NAME, givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: "699112233", residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
      reason: "Bilan", clinicalNote: "RAS", vitals: null, provisionalDiagnosis: null, recommendation: null,
    });
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 2000, quantity: 1 }]);
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 2000, method: "cash" });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const snapshot = await generateHospitalAggregateSnapshot(admin.actor, admin.ctx);
    const indicators = snapshot.indicators as Record<string, unknown>;

    // Aggregate counts/totals are present…
    expect(indicators.consultationCount).toBeGreaterThanOrEqual(1);
    expect(indicators.patientCount).toBeGreaterThanOrEqual(1);
    expect(indicators.revenueTotalFcfa).toBeGreaterThanOrEqual(2000);
    // …the payload has ONLY the allowed aggregate keys…
    expect(Object.keys(indicators).sort()).toEqual(ALLOWED_INDICATOR_KEYS);
    // …and NO patient identifier (name / number / phone) leaks into the snapshot.
    const json = JSON.stringify(indicators);
    expect(json).not.toContain(SECRET_NAME);
    expect(json).not.toContain(patient.patientNumber);
    expect(json).not.toContain("699112233");
    // Audited.
    expect(
      await prisma.auditLog.count({ where: { hospitalId: HRB, action: "central.snapshot.generated" } }),
    ).toBe(1);
  });

  it("the central viewer reads the snapshot aggregates only (no patient-level), audited", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const patient = await createPatientForActor(admin.actor, admin.ctx, {
      familyName: SECRET_NAME, givenName: "X", sex: "female", dateOfBirth: new Date("1991-02-02"), phone: null, residence: null,
    }).catch(() => null); // admin lacks patient.create — fine, fall back to reception
    if (!patient) {
      const reception = await loginAndSelect(ACCOUNTS.reception);
      await createPatientForActor(reception.actor, reception.ctx, {
        familyName: SECRET_NAME, givenName: "X", sex: "female", dateOfBirth: new Date("1991-02-02"), phone: null, residence: null,
      });
    }
    await generateHospitalAggregateSnapshot(admin.actor, admin.ctx);

    const central = await actorFor(CENTRAL);
    const before = await prisma.auditLog.count({ where: { action: "central.aggregate.accessed" } });
    const { hospitals } = await getCentralOversight(central);
    const bertoua = hospitals.find((h) => h.hospitalId === HRB);
    expect(bertoua).toBeTruthy();
    expect(bertoua!.indicators.patientCount).toBeGreaterThanOrEqual(1);
    // No patient identifier anywhere in the central payload.
    expect(JSON.stringify(hospitals)).not.toContain(SECRET_NAME);
    expect(
      await prisma.auditLog.count({ where: { action: "central.aggregate.accessed" } }),
    ).toBe(before + 1);
  });

  it("a hospital role without central.aggregate.view is DENIED the central view (audited)", async () => {
    const admin = await actorFor(ACCOUNTS.admin); // administrateur lacks central.aggregate.view
    const before = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    await expect(getCentralOversight(admin)).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.auditLog.count({ where: { action: "authz.denied" } })).toBe(before + 1);
  });

  it("the central supervisor cannot GENERATE a snapshot (no report.operational.read)", async () => {
    const central = await actorFor(CENTRAL);
    const ctx = await selectHospital(central, HRB);
    await expect(generateHospitalAggregateSnapshot(central, ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a FREE-TYPED diagnosis label never reaches the snapshot — only the canonical ICD label, valid codes only", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "DIAG", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Fièvre" });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const consultation = await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
      reason: "Fièvre", clinicalNote: "RAS", vitals: null, provisionalDiagnosis: null, recommendation: null,
    });
    // A VALID ICD code but a clinician free-typed label carrying patient-identifying text…
    await addDiagnosis(doctor.actor, doctor.ctx, consultation.id, { code: "B50", label: `Palu — M. ${SECRET_NAME}`, isPrimary: true });
    // …and a FREE-TYPED, non-reference code.
    await addDiagnosis(doctor.actor, doctor.ctx, consultation.id, { code: "FREECODE", label: "Truc inventé SECRET2" });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const snapshot = await generateHospitalAggregateSnapshot(admin.actor, admin.ctx);
    const indicators = snapshot.indicators as { topDiagnoses: { code: string; label: string; count: number }[] };
    const json = JSON.stringify(indicators);

    // The valid code is kept but with the CANONICAL reference label — never the clinician's free text.
    const b50 = indicators.topDiagnoses.find((d) => d.code === "B50");
    expect(b50?.label).toBe("Paludisme à Plasmodium falciparum");
    expect(json).not.toContain(SECRET_NAME);
    // The free-typed / non-reference code is dropped entirely.
    expect(indicators.topDiagnoses.some((d) => d.code === "FREECODE")).toBe(false);
    expect(json).not.toContain("SECRET2");
  });
});
