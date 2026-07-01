import { beforeEach, describe, expect, it } from "vitest";

import { getDashboardSummary } from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";
import { runGoldenPath } from "../helpers/golden";

describe("integration: dashboard (06 §11, 07 §10)", () => {
  beforeEach(resetTestDb);

  it("reads 1 / 1 / 3 000 FCFA after the golden path", async () => {
    await runGoldenPath();
    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);

    expect(summary.patientsToday).toBe(1);
    expect(summary.openEncounters).toBe(1);
    expect(summary.collectionsToday).toBe(3000);

    // Recent activity is the newest entries (capped), so it includes the payment;
    // the full audit log (queried directly) contains the patient creation.
    const actions = summary.recent.map((r) => r.action);
    expect(actions).toContain("payment.record");
    expect(summary.recent.length).toBeGreaterThan(0);
    expect(
      await prisma.auditLog.count({ where: { action: "patient.create" } }),
    ).toBe(1);
  });

  it("reads 0 / 0 / 0 on a freshly reset hospital", async () => {
    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);
    expect(summary.patientsToday).toBe(0);
    expect(summary.openEncounters).toBe(0);
    expect(summary.collectionsToday).toBe(0);
  });

  it("Batch 5: daily aggregations + role-specific sections (hospital-scoped)", async () => {
    await runGoldenPath();
    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);
    // Daily activity / clinical / billing aggregations.
    expect(summary.encountersOpenedToday).toBe(1);
    expect(summary.consultationsToday).toBe(1);
    expect(summary.invoicesToday).toBe(1);
    expect(summary.byMethod).toEqual([
      expect.objectContaining({ method: "cash", total: 3000, count: 1 }),
    ]);
    // Director (oversight) sees all sections.
    expect(summary.sections).toEqual({ activity: true, clinical: true, billing: true, management: true });

    // Reception sees activity only (no billing/clinical/management sections).
    const rec = await loginAndSelect(ACCOUNTS.reception);
    const recSummary = await getDashboardSummary(rec.actor, rec.ctx);
    expect(recSummary.sections).toEqual({ activity: true, clinical: false, billing: false, management: false });

    // Cashier sees billing but not clinical.
    const cai = await loginAndSelect(ACCOUNTS.cashier);
    const caiSummary = await getDashboardSummary(cai.actor, cai.ctx);
    expect(caiSummary.sections.billing).toBe(true);
    expect(caiSummary.sections.clinical).toBe(false);
  });

  it("Batch 5: figures are hospital-scoped (no cross-hospital leak)", async () => {
    await runGoldenPath(); // creates HRB-DEMO data
    // Seed a patient + paid invoice in ANOTHER hospital directly.
    const otherPatient = await prisma.patient.create({
      data: { hospitalId: "hosp-hrn-nga", patientNumber: "HRN-P-1", familyName: "Z", givenName: "Z", sex: "male", dateOfBirth: new Date("1990-01-01") },
    });
    const otherEnc = await prisma.encounter.create({
      data: { hospitalId: "hosp-hrn-nga", patientId: otherPatient.id, encounterNumber: "HRN-V-1", serviceLabel: "x", reason: "x" },
    });
    const otherInv = await prisma.invoice.create({
      data: { hospitalId: "hosp-hrn-nga", encounterId: otherEnc.id, invoiceNumber: "HRN-F-1", status: "paid", totalAmount: 9999 },
    });
    await prisma.payment.create({
      data: { hospitalId: "hosp-hrn-nga", invoiceId: otherInv.id, receiptNumber: "HRN-R-1", amount: 9999, method: "cash", status: "recorded" },
    });

    const dir = await loginAndSelect(ACCOUNTS.director);
    const summary = await getDashboardSummary(dir.actor, dir.ctx);
    // Only HRB-DEMO figures — the other hospital's 9 999 is not included.
    expect(summary.collectionsToday).toBe(3000);
    expect(summary.patientsToday).toBe(1);
  });
});
