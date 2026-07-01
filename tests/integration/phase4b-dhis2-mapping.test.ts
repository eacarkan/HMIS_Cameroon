import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  addDiagnosis,
  createDhis2MappingSetForActor,
  createPatientForActor,
  exportDhis2MappedCsv,
  getDhis2ExportReadiness,
  getDhis2MappingAdmin,
  openEncounter,
  recordConsultation,
  runDhis2MockApiExport,
  upsertDhis2MappingForActor,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 4B — DHIS2 configurable export / API-readiness (DB-backed). Aggregate-only. Proves: mapping
 * sets are hospital-scoped + audited; RBAC (admin manages; clinical denied; cross-hospital denied);
 * validation BEFORE export (unmapped → export refused); the manual CSV is aggregate-only (no
 * identifiers); the mock API export runs with NO network (egress guard) + is audited. Synthetic only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";
const now = new Date();
const PERIOD = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
const SECRET = "ZZZSECRETPATIENT4B";

async function seedConsultationWithDiagnosis() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: SECRET, givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Fièvre" });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const consult = await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
    reason: "Fièvre", clinicalNote: "RAS", vitals: null, provisionalDiagnosis: null, recommendation: null,
  });
  await addDiagnosis(doctor.actor, doctor.ctx, consult.id, { code: "B50", label: "Paludisme", isPrimary: true });
  return { patient };
}

describe("integration: Phase 4B DHIS2 export framework", () => {
  beforeEach(resetTestDb);
  afterEach(() => vi.restoreAllMocks());

  it("an admin creates a mapping set + mapping (hospital-scoped, audited)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const set = await createDhis2MappingSetForActor(admin.actor, admin.ctx, { code: "DEFAUT", name: "Défaut", orgUnitPlaceholder: "OU_UID" });
    expect(set.hospitalId).toBe(HRB);
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "CONSULTATIONS", dataElementPlaceholder: "DE_CONS" });
    expect(await prisma.dhis2Mapping.count({ where: { hospitalId: HRB } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "dhis2.mapping_updated" } })).toBe(2);
  });

  it("a clinical role is DENIED and cross-hospital management is denied", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getDhis2MappingAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createDhis2MappingSetForActor(admin.actor, { ...admin.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" }, { code: "X", name: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("validation BEFORE export: unmapped elements block export until mapped", async () => {
    await seedConsultationWithDiagnosis();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const set = await createDhis2MappingSetForActor(admin.actor, admin.ctx, { code: "DEFAUT", name: "Défaut" });

    const before = await getDhis2ExportReadiness(admin.actor, admin.ctx, { mappingSetId: set.id, ...PERIOD });
    expect(before.ready).toBe(false);
    expect(before.unmapped).toContain("CONSULTATIONS");
    expect(before.unmapped).toContain("DIAG:B50");
    // Export refused while unmapped.
    await expect(exportDhis2MappedCsv(admin.actor, admin.ctx, { mappingSetId: set.id, ...PERIOD })).rejects.toThrow(/non mapp/i);

    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "CONSULTATIONS", dataElementPlaceholder: "DE_CONS" });
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "DIAG:*", dataElementPlaceholder: "DE_DIAG" });
    const after = await getDhis2ExportReadiness(admin.actor, admin.ctx, { mappingSetId: set.id, ...PERIOD });
    expect(after.ready).toBe(true);
  });

  it("the mapped CSV export is aggregate-only (no patient identifier) and audited", async () => {
    const { patient } = await seedConsultationWithDiagnosis();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const set = await createDhis2MappingSetForActor(admin.actor, admin.ctx, { code: "DEFAUT", name: "Défaut" });
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "CONSULTATIONS", dataElementPlaceholder: "DE_CONS" });
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "DIAG:*", dataElementPlaceholder: "DE_DIAG" });

    const { csv, rowCount } = await exportDhis2MappedCsv(admin.actor, admin.ctx, { mappingSetId: set.id, ...PERIOD });
    expect(rowCount).toBeGreaterThanOrEqual(1);
    expect(csv).toContain("period,orgUnit,dataElement,ageBand,gender,value");
    // No patient identifier reaches the CSV.
    expect(csv).not.toContain(SECRET);
    expect(csv).not.toContain(patient.patientNumber);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "dhis2.export_csv" } })).toBe(1);
  });

  it("the mock API export runs with NO network (egress guard) and is audited", async () => {
    await seedConsultationWithDiagnosis();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const set = await createDhis2MappingSetForActor(admin.actor, admin.ctx, { code: "DEFAUT", name: "Défaut" });
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "CONSULTATIONS", dataElementPlaceholder: "DE_CONS" });
    await upsertDhis2MappingForActor(admin.actor, admin.ctx, { mappingSetId: set.id, localElement: "DIAG:*", dataElementPlaceholder: "DE_DIAG" });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation((() => {
        throw new Error("NETWORK EGRESS BLOCKED IN TEST");
      }) as unknown as typeof fetch);
    const result = await runDhis2MockApiExport(admin.actor, admin.ctx, { mappingSetId: set.id, ...PERIOD });
    expect(result.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "dhis2.export_mock_api" } })).toBe(1);
    expect(await prisma.reportExport.count({ where: { hospitalId: HRB, kind: "dhis2_mock_api" } })).toBe(1);
  });
});
