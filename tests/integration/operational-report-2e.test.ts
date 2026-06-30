import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  addDiagnosis,
  createPatientForActor,
  exportDhis2Csv,
  getOperationalReport,
  openEncounter,
  recordConsultation,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";
const PATIENT_NAME = "MENGUEPRIVACY"; // a distinctive name we assert NEVER appears in the export

// Current UTC month — the seeded/created data is stamped "now".
function currentMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

/** Create a patient + visit + finalized consultation + a coded diagnosis. Returns ids. */
async function seenPatient(opts: { dob: string; sex: "male" | "female"; code: string; label: string }) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: PATIENT_NAME,
    givenName: "Aimee",
    sex: opts.sex,
    dateOfBirth: new Date(opts.dob),
    phone: null,
    residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
    serviceLabel: "Médecine générale",
    reason: "Fièvre",
  });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const consultation = await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
    reason: "Fièvre",
    clinicalNote: "RAS",
    vitals: null,
    provisionalDiagnosis: null,
    recommendation: null,
  });
  await addDiagnosis(doctor.actor, doctor.ctx, consultation.id, {
    label: opts.label,
    code: opts.code,
    isPrimary: true,
  });
  return { patientId: patient.id };
}

describe("integration: Phase 2E — operational reporting + DHIS2 export", () => {
  beforeEach(resetTestDb);

  it("aggregates consultations, age/gender, and Top-10 diagnoses for the month", async () => {
    await seenPatient({ dob: "1990-01-01", sex: "female", code: "B50", label: "Paludisme" });
    await seenPatient({ dob: "2024-01-01", sex: "male", code: "J06", label: "IVRS" });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const report = await getOperationalReport(admin.actor, admin.ctx, currentMonth());

    expect(report.consultationCount).toBe(2);
    expect(report.diagnoses.find((d) => d.code === "B50")?.count).toBe(1);
    expect(report.diagnoses.find((d) => d.code === "J06")?.count).toBe(1);
    // One adult woman + one infant boy.
    const adultF = report.ageGender.find((r) => r.band === "35-49");
    const infantM = report.ageGender.find((r) => r.band === "1-4");
    expect(adultF!.F).toBe(1);
    expect(infantM!.M).toBe(1);
    expect(report.orgUnit).toBe("HRB-DEMO");
  });

  it("the DHIS2 CSV is AGGREGATE-only and contains NO patient identifier; the export is recorded + audited", async () => {
    await seenPatient({ dob: "1990-01-01", sex: "female", code: "B50", label: "Paludisme" });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const { csv, rowCount } = await exportDhis2Csv(admin.actor, admin.ctx, currentMonth());

    expect(rowCount).toBeGreaterThan(0);
    // PRIVACY: the patient name must NEVER appear in the aggregate export.
    expect(csv).not.toContain(PATIENT_NAME);
    expect(csv).not.toMatch(/Aimee/);
    // Aggregate rows are present.
    expect(csv).toContain("CONSULTATIONS");
    expect(csv).toContain("DIAG:B50");
    expect(csv).toContain("HRB-DEMO");

    // The export is recorded in history + audited (period + scope + row count; no patient data).
    const exports = await prisma.reportExport.findMany({ where: { hospitalId: HRB } });
    expect(exports).toHaveLength(1);
    expect(exports[0].kind).toBe("dhis2_monthly");
    expect(exports[0].rowCount).toBe(rowCount);
    const audit = await prisma.auditLog.findFirst({ where: { action: "report.exported_csv" } });
    expect(audit?.summary).toContain("HRB-DEMO");
    expect(audit?.summary).not.toContain(PATIENT_NAME);
  });

  it("RBAC: only admin/director read reports; only admin exports", async () => {
    const month = currentMonth();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const director = await loginAndSelect(ACCOUNTS.director);
    const admin = await loginAndSelect(ACCOUNTS.admin);

    // Read: admin + director yes; cashier/reception/doctor no.
    await expect(getOperationalReport(cashier.actor, cashier.ctx, month)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getOperationalReport(reception.actor, reception.ctx, month)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getOperationalReport(doctor.actor, doctor.ctx, month)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getOperationalReport(director.actor, director.ctx, month)).resolves.toBeTruthy();
    await expect(getOperationalReport(admin.actor, admin.ctx, month)).resolves.toBeTruthy();

    // Export: admin only — the director (read-only oversight) cannot export.
    await expect(exportDhis2Csv(director.actor, director.ctx, month)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(exportDhis2Csv(admin.actor, admin.ctx, month)).resolves.toBeTruthy();
  });

  it("hospital scoping: another hospital's consultation is NOT counted in this hospital's report", async () => {
    await seenPatient({ dob: "1990-01-01", sex: "female", code: "B50", label: "Paludisme" }); // HRB-DEMO

    // A consultation in a DIFFERENT hospital (HRN-NGA) — must be invisible to the HRB-DEMO report.
    const otherPatient = await prisma.patient.create({
      data: { hospitalId: "hosp-hrn-nga", patientNumber: "HRN-P-9", familyName: "Z", givenName: "Z", sex: "male", dateOfBirth: new Date("1980-01-01") },
    });
    const otherEnc = await prisma.encounter.create({
      data: { hospitalId: "hosp-hrn-nga", patientId: otherPatient.id, encounterNumber: "HRN-V-9", serviceLabel: "x", reason: "x" },
    });
    await prisma.consultation.create({
      data: { hospitalId: "hosp-hrn-nga", encounterId: otherEnc.id, status: "finalized", reason: "x", performedById: null },
    });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const report = await getOperationalReport(admin.actor, admin.ctx, currentMonth());
    expect(report.consultationCount).toBe(1); // only the HRB-DEMO consultation
    expect(report.orgUnit).toBe("HRB-DEMO");
  });

  it("an empty month yields zero counts and a header-only CSV (no throw)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const report = await getOperationalReport(admin.actor, admin.ctx, { year: 2020, month: 1 });
    expect(report.consultationCount).toBe(0);
    expect(report.diagnoses).toHaveLength(0);

    const { csv, rowCount } = await exportDhis2Csv(admin.actor, admin.ctx, { year: 2020, month: 1 });
    expect(rowCount).toBe(0);
    // Header-only CSV (BOM + header + CRLF), no data rows.
    expect(csv.replace(/^﻿/, "").trim()).toBe("period,orgUnit,dataElement,ageBand,gender,value");
  });

  it("a consultation WITHOUT a diagnosis is still counted; it produces no DIAG row", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: PATIENT_NAME, givenName: "Sans", sex: "male", dateOfBirth: new Date("1995-01-01"), phone: null, residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Contrôle" });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
      reason: "Contrôle", clinicalNote: null, vitals: null, provisionalDiagnosis: null, recommendation: null,
    });

    const admin = await loginAndSelect(ACCOUNTS.admin);
    const report = await getOperationalReport(admin.actor, admin.ctx, currentMonth());
    expect(report.consultationCount).toBe(1);
    const { csv } = await exportDhis2Csv(admin.actor, admin.ctx, currentMonth());
    expect(csv).toContain("CONSULTATIONS");
    expect(csv).not.toContain("DIAG:");
  });
});
