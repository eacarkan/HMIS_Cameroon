import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmDiagnosticPayment,
  createPatientForActor,
  getDiagnosticOrder,
  getExternalResultQueue,
  importExternalResults,
  openEncounter,
  requestDiagnostic,
  reviewExternalResult,
  startDiagnostic,
  validateDiagnosticResult,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 4C — external result import (DB-backed). THE #1 GUARANTEE: an imported result is a STAGING
 * record and NEVER reaches the doctor-visible validated-result area until it is reviewed, promoted, and
 * separately validated. Also: importer ≠ reviewer; matching is warning-only; dedupe; hospital-scoped;
 * audited; no analyzer/PACS. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

async function inProgressOrder() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "IMPORT", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId: enc.id, catalogueItemId: item.id });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  await confirmDiagnosticPayment(cashier.actor, cashier.ctx, order.id);
  const tech = await loginAndSelect(ACCOUNTS.labTech);
  await startDiagnostic(tech.actor, tech.ctx, order.id); // → in_progress
  const full = await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: order.id } });
  return { patient, order: full, doctor };
}

function csvFor(patientNumber: string, orderNumber: string) {
  return `externalRef,patientRef,orderRef,modality,testCode,resultText\nEXT-1,${patientNumber},${orderNumber},lab,NFS,Hb 12 g/dL`;
}

describe("integration: Phase 4C external result import", () => {
  beforeEach(resetTestDb);

  it("an admin imports a result to STAGING (matched, audited); re-import is deduped", async () => {
    const { patient, order } = await inProgressOrder();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const res = await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });
    expect(res.imported).toBe(1);
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    expect(staged.status).toBe("NEEDS_REVIEW");
    expect(staged.matchedOrderId).toBe(order.id);
    expect(staged.matchWarning).toBeNull();
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "external_result.imported" } })).toBe(1);
    // Re-import → deduped (unique key), no second staging row.
    const again = await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });
    expect(again.duplicates).toBe(1);
    expect(await prisma.externalResultImport.count({ where: { hospitalId: HRB } })).toBe(1);
  });

  it("an unmatched patient/order produces a WARNING (never an automatic clinical link)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const res = await importExternalResults(admin.actor, admin.ctx, {
      source: "CSV",
      csv: "externalRef,patientRef,orderRef,modality,testCode,resultText\nEXT-9,UNKNOWN-P,UNKNOWN-O,lab,NFS,RAS",
    });
    expect(res.warnings).toBe(1);
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    expect(staged.matchedOrderId).toBeNull();
    expect(staged.matchWarning).toContain("introuvable");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "external_result.match_warning" } })).toBe(1);
  });

  it("THE #1 GUARANTEE: an imported result is NOT doctor-visible until promoted AND validated", async () => {
    const { patient, order, doctor } = await inProgressOrder();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });

    // Before review — the clinical order has NO result and the doctor sees nothing.
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, order.id))?.resultText ?? null).toBeNull();
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: order.id } })).resultText).toBeNull();

    // The reviewer (a DIFFERENT person from the importer) promotes → the result is ENTERED via the
    // existing path (reviewer = enterer) but is STILL hidden from the doctor (not validated).
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    await reviewExternalResult(tech.actor, tech.ctx, staged.id, { decision: "promote" });
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("result_entered");
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, order.id))?.resultText ?? null).toBeNull(); // still hidden

    // A SEPARATE validator (≠ the enterer) validates → only NOW is it doctor-visible.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, order.id);
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, order.id))?.resultText).toContain("Hb 12");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "external_result.promoted" } })).toBe(1);
  });

  it("the importer (admin) cannot review; a clinical/other role is denied; cross-hospital denied", async () => {
    const { patient, order } = await inProgressOrder();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    // The admin holds import but NOT review (importer ≠ reviewer by role separation).
    await expect(reviewExternalResult(admin.actor, admin.ctx, staged.id, { decision: "promote" })).rejects.toBeInstanceOf(AuthorizationError);
    // A doctor cannot import.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(importExternalResults(doctor.actor, doctor.ctx, { source: "CSV", csv: "x" })).rejects.toBeInstanceOf(AuthorizationError);
    // Cross-hospital import denied.
    await expect(
      importExternalResults(admin.actor, { ...admin.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" }, { source: "CSV", csv: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("a reviewer can REJECT a staged import (audited); a decided import cannot be re-reviewed", async () => {
    const { patient, order } = await inProgressOrder();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await reviewExternalResult(tech.actor, tech.ctx, staged.id, { decision: "reject", reason: "Doublon manuel" });
    expect((await prisma.externalResultImport.findUniqueOrThrow({ where: { id: staged.id } })).status).toBe("REJECTED");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "external_result.rejected" } })).toBe(1);
    // Cannot re-review a decided import.
    await expect(reviewExternalResult(tech.actor, tech.ctx, staged.id, { decision: "promote" })).rejects.toThrow(/traitée/i);
  });

  it("the review queue is visible to the reviewer", async () => {
    const { patient, order } = await inProgressOrder();
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await importExternalResults(admin.actor, admin.ctx, { source: "CSV", csv: csvFor(patient.patientNumber, order.orderNumber) });
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    const queue = await getExternalResultQueue(tech.actor, tech.ctx);
    expect(queue.items.length).toBe(1);
    expect(queue.canReview).toBe(true);
  });

  it("(review fix) a patient/order MISMATCH is never a promotion candidate (no wrong-patient write)", async () => {
    const { order } = await inProgressOrder(); // order belongs to patient "IMPORT"
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const other = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "AUTRE", givenName: "Patient", sex: "female", dateOfBirth: new Date("1985-01-01"), phone: null, residence: null,
    });
    const admin = await loginAndSelect(ACCOUNTS.admin);
    // patientRef = the OTHER patient, orderRef = the first patient's in-progress order → mismatch.
    await importExternalResults(admin.actor, admin.ctx, {
      source: "CSV",
      csv: `externalRef,patientRef,orderRef,modality,testCode,resultText\nEXT-MM,${other.patientNumber},${order.orderNumber},lab,NFS,Hb 9`,
    });
    const staged = await prisma.externalResultImport.findFirstOrThrow({ where: { hospitalId: HRB } });
    expect(staged.matchedOrderId).toBeNull(); // the mismatched order is NOT stored as a promotion target
    expect(staged.matchWarning).toContain("incohérents");
    // Promotion is impossible (no matched order) → the wrong-patient write can never happen.
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await expect(reviewExternalResult(tech.actor, tech.ctx, staged.id, { decision: "promote" })).rejects.toThrow(/correspondante/i);
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: order.id } })).resultText).toBeNull();
  });
});
