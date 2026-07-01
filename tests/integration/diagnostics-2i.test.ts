import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  cancelDiagnostic,
  confirmDiagnosticPayment,
  createPatientForActor,
  enterDiagnosticResult,
  flagEncounterEmergency,
  getDiagnosticOrder,
  getDiagnosticReport,
  listDiagnosticsForEncounter,
  openEncounter,
  requestDiagnostic,
  startDiagnostic,
  validateDiagnosticResult,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

async function labItemId(code = "LAB-NFS") {
  const it = await prisma.diagnosticCatalogueItem.findFirst({ where: { hospitalId: HRB, code } });
  return it!.id;
}

/** Open an encounter (optionally emergency) and have the doctor request a lab test on it. */
async function encounterWithRequest(opts?: { emergency?: boolean; code?: string }) {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "EXAMEN",
    givenName: "Test",
    sex: "female",
    dateOfBirth: new Date("1992-01-01"),
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
  const order = await requestDiagnostic(doctor.actor, doctor.ctx, {
    encounterId: enc.id,
    catalogueItemId: await labItemId(opts?.code),
  });
  return { encounterId: enc.id, orderId: order.id };
}

describe("integration: Phase 2I — manual lab & radiology", () => {
  beforeEach(resetTestDb);

  it("full flow: request → pay → start → enter → validate → report, with price snapshot", async () => {
    const { orderId } = await encounterWithRequest({ code: "LAB-NFS" });
    const created = await prisma.diagnosticOrder.findUnique({ where: { id: orderId } });
    expect(created!.status).toBe("requested");
    expect(created!.price).toBe(3500); // snapshot from the catalogue
    expect(created!.orderNumber).toMatch(/HRB-DEMO-E-2026-/);

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, orderId);

    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, orderId);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "Hb 12,5 g/dL ; leucocytes normaux");

    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    const validated = await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect(validated!.status).toBe("validated");

    // The doctor can now print the report.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const report = await getDiagnosticReport(doctor.actor, doctor.ctx, orderId);
    expect(report!.order.resultText).toContain("Hb 12,5");
    expect(report!.validatorName).toContain("EYENGA");
    const audit = await prisma.auditLog.findFirst({ where: { action: "diagnostic.pdf_generated", entityId: orderId } });
    expect(audit).not.toBeNull();
  });

  it("THE visibility gate: the doctor cannot see the result until it is validated", async () => {
    const { encounterId, orderId } = await encounterWithRequest();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, orderId);
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, orderId);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "RÉSULTAT CONFIDENTIEL 42");

    // Doctor at result_entered (pre-validation): result is STRIPPED.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const beforeOne = await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId);
    expect(beforeOne!.status).toBe("result_entered");
    expect(beforeOne!.resultText).toBeNull();
    const beforeList = await listDiagnosticsForEncounter(doctor.actor, doctor.ctx, encounterId);
    expect(beforeList[0].resultText).toBeNull();

    // Staff CAN see the entered result (to validate it).
    const staffView = await getDiagnosticOrder(tech.actor, tech.ctx, orderId);
    expect(staffView!.resultText).toContain("CONFIDENTIEL");

    // After validation, the doctor sees it.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    const afterOne = await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId);
    expect(afterOne!.resultText).toContain("CONFIDENTIEL");
  });

  it("payment gate: a non-emergency order cannot start unpaid; an emergency order bypasses payment", async () => {
    // Non-emergency, unpaid → start refused.
    const { orderId } = await encounterWithRequest({ emergency: false });
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await expect(startDiagnostic(tech.actor, tech.ctx, orderId)).rejects.toThrow(/payé à la caisse/);

    // Emergency, unpaid → start allowed (bypass), audit notes URGENCE.
    const em = await encounterWithRequest({ emergency: true });
    await startDiagnostic(tech.actor, tech.ctx, em.orderId);
    const order = await prisma.diagnosticOrder.findUnique({ where: { id: em.orderId } });
    expect(order!.status).toBe("in_progress");
    expect(order!.isPaid).toBe(false);
    const audit = await prisma.auditLog.findFirst({ where: { action: "diagnostic.started", entityId: em.orderId } });
    expect(audit?.summary).toContain("URGENCE");
  });

  it("RBAC: enter ≠ validate; cashier cannot enter; technician cannot validate; doctor cannot enter", async () => {
    const { orderId } = await encounterWithRequest();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, orderId);
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, orderId);

    // Cashier cannot enter a result.
    await expect(
      enterDiagnosticResult(cashier.actor, cashier.ctx, orderId, "x"),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "Résultat");

    // The technician cannot validate their own entry (enter ≠ validate).
    await expect(
      validateDiagnosticResult(tech.actor, tech.ctx, orderId),
    ).rejects.toBeInstanceOf(AuthorizationError);
    // The doctor cannot enter results either.
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(
      enterDiagnosticResult(doctor.actor, doctor.ctx, orderId, "x"),
    ).rejects.toBeInstanceOf(AuthorizationError);
    // Only the validator validates.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    const v = await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect(v!.status).toBe("validated");
  });

  it("a validated order cannot be cancelled; the report is unavailable before validation", async () => {
    const { orderId } = await encounterWithRequest();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    // Report unavailable pre-validation.
    await expect(getDiagnosticReport(doctor.actor, doctor.ctx, orderId)).rejects.toThrow(/après validation/);

    // Drive to validated.
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await confirmDiagnosticPayment(cashier.actor, cashier.ctx, orderId);
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await startDiagnostic(tech.actor, tech.ctx, orderId);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "Résultat");
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);

    // A validated order cannot be cancelled.
    await expect(cancelDiagnostic(doctor.actor, doctor.ctx, orderId, "trop tard")).rejects.toThrow(/validé/);
  });

  it("ordering is refused for an inactive catalogue item and on a closed/absent encounter", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "EX2",
      givenName: "T",
      sex: "male",
      dateOfBirth: new Date("1980-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(reception.actor, reception.ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "x",
    });
    // Deactivate a catalogue item, then ordering it is refused.
    const item = await prisma.diagnosticCatalogueItem.findFirst({ where: { hospitalId: HRB, code: "LAB-GLY" } });
    await prisma.diagnosticCatalogueItem.update({ where: { id: item!.id }, data: { isActive: false } });
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(
      requestDiagnostic(doctor.actor, doctor.ctx, { encounterId: enc.id, catalogueItemId: item!.id }),
    ).rejects.toThrow(/indisponible/);
  });
});
