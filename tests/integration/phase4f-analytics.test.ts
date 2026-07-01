import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  addDiagnosis,
  createInvoice,
  createPatientForActor,
  createReportDefinitionForActor,
  exportReportRunForActor,
  getAnalyticsAdmin,
  openEncounter,
  recordConsultation,
  recordPayment,
  runReportForActor,
  setReportDefinitionActiveForActor,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 4F — advanced reporting / analytics (DB-backed). PRIVACY IS THE #1 DIMENSION: a report reuses the
 * aggregate operational report and stores ONLY aggregate rows — no patient identifier ever reaches a run
 * result or an export. Runs are guarded (PENDING → COMPLETED/FAILED); exports are recorded in a registry;
 * everything is hospital-scoped, RBAC server-authoritative, and audited. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";
const SECRET_NAME = "ZZZSECRETANALYTICS";

function currentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** One synthetic consultation (distinctive patient name + phone) + a diagnosis + a payment. */
async function seedActivity() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: SECRET_NAME, givenName: "Probe", sex: "female", dateOfBirth: new Date("1990-01-01"), phone: "699445566", residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Fièvre" });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const consultation = await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
    reason: "Fièvre", clinicalNote: "RAS", vitals: null, provisionalDiagnosis: null, recommendation: null,
  });
  await addDiagnosis(doctor.actor, doctor.ctx, consultation.id, { label: "Paludisme", code: "B50", isPrimary: true });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 3000, quantity: 1 }]);
  await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 3000, method: "cash" });
  return { patient };
}

describe("integration: Phase 4F analytics / reporting (aggregate-only)", () => {
  beforeEach(resetTestDb);

  it("an admin defines a report and runs it — aggregate rows only, NO patient identifier, audited", async () => {
    const { patient } = await seedActivity();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const def = await createReportDefinitionForActor(admin.actor, admin.ctx, { code: "MENSUEL", name: "Synthèse mensuelle", kind: "OPERATIONAL_SUMMARY" });
    expect(def.hospitalId).toBe(HRB);

    const run = await runReportForActor(admin.actor, admin.ctx, { definitionId: def.id, ...currentMonth() });
    expect(run?.status).toBe("COMPLETED");
    expect(run?.rowCount).toBeGreaterThan(0);
    // The stored result carries ONLY whitelisted aggregate keys…
    const rows = (run?.resultJson ?? []) as Record<string, unknown>[];
    const allowed = new Set(["section", "dimension", "subDimension", "label", "value"]);
    for (const r of rows) for (const k of Object.keys(r)) expect(allowed.has(k)).toBe(true);
    expect(rows.some((r) => r.section === "diagnosis" && r.dimension === "B50")).toBe(true);
    // …and NO patient identifier (name / number / phone) leaks into the run result.
    const json = JSON.stringify(run?.resultJson);
    expect(json).not.toContain(SECRET_NAME);
    expect(json).not.toContain(patient.patientNumber);
    expect(json).not.toContain("699445566");
    // Audited.
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "analytics.definition_created" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "analytics.report_run" } })).toBe(1);
  });

  it("a completed run is exported to the registry (CSV + JSON), aggregate-only, audited", async () => {
    await seedActivity();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const def = await createReportDefinitionForActor(admin.actor, admin.ctx, { code: "DIAG", name: "Top diagnostics", kind: "TOP_DIAGNOSES", topN: 5 });
    const run = await runReportForActor(admin.actor, admin.ctx, { definitionId: def.id, ...currentMonth() });

    const csv = await exportReportRunForActor(admin.actor, admin.ctx, { runId: run!.id, format: "CSV" });
    expect(csv.content.split("\r\n")[0]).toBe("section,dimension,subDimension,label,value");
    expect(csv.content).not.toContain(SECRET_NAME);
    const json = await exportReportRunForActor(admin.actor, admin.ctx, { runId: run!.id, format: "JSON" });
    expect(json.rowCount).toBe(run!.rowCount);

    expect(await prisma.reportRunExport.count({ where: { hospitalId: HRB, reportRunId: run!.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "analytics.report_exported" } })).toBe(2);
  });

  it("a disabled definition cannot run; a non-completed run cannot be exported", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const def = await createReportDefinitionForActor(admin.actor, admin.ctx, { code: "REV", name: "Recettes", kind: "REVENUE_BY_METHOD" });
    await setReportDefinitionActiveForActor(admin.actor, admin.ctx, def.id, false);
    await expect(runReportForActor(admin.actor, admin.ctx, { definitionId: def.id, ...currentMonth() })).rejects.toThrow(/désactivée/i);

    // A PENDING run (never completed) cannot be exported.
    const pending = await prisma.reportRun.create({
      data: { hospitalId: HRB, reportDefinitionId: def.id, periodLabel: "2026-06", periodStart: new Date("2026-06-01"), periodEnd: new Date("2026-07-01"), trigger: "ON_DEMAND", status: "PENDING" },
    });
    await expect(exportReportRunForActor(admin.actor, admin.ctx, { runId: pending.id, format: "CSV" })).rejects.toThrow(/terminée/i);
  });

  it("RBAC: clinical denied; the director may VIEW but not manage/run; cross-hospital denied", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getAnalyticsAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);

    // The director holds analytics.report.view (read) but NOT analytics.report.manage.
    const director = await loginAndSelect(ACCOUNTS.director);
    const view = await getAnalyticsAdmin(director.actor, director.ctx);
    expect(view.canManage).toBe(false);
    await expect(
      createReportDefinitionForActor(director.actor, director.ctx, { code: "X", name: "x", kind: "OPERATIONAL_SUMMARY" }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    // Cross-hospital definition creation denied.
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createReportDefinitionForActor(admin.actor, { ...admin.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" }, { code: "Y", name: "y", kind: "OPERATIONAL_SUMMARY" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
