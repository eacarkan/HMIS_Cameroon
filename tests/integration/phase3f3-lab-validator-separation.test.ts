import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  confirmDiagnosticPayment,
  createPatientForActor,
  enterDiagnosticResult,
  getDiagnosticOrder,
  openEncounter,
  requestDiagnostic,
  startDiagnostic,
  validateDiagnosticResult,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3F-3 — Lab/radiology validator separation (doc 34 §11). VERIFIES the Phase 2 hardening
 * delivered as H1 (commit 17a9fa1): the user who ENTERS a result cannot VALIDATE the same result —
 * even holding both capabilities — enforced server-side (+ a DB-layer `NOT enteredById` guard), and
 * the doctor cannot see an unvalidated result. Maps to doc 34 §11.14. No logic re-implemented.
 * Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

async function orderReadyForResult() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "LABO", givenName: "Probe", sex: "male", dateOfBirth: new Date("1980-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const item = await prisma.diagnosticCatalogueItem.findFirstOrThrow({ where: { hospitalId: HRB, code: "LAB-NFS" } });
  const order = await requestDiagnostic(doctor.actor, doctor.ctx, { encounterId: enc.id, catalogueItemId: item.id });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  await confirmDiagnosticPayment(cashier.actor, cashier.ctx, order.id);
  const tech = await loginAndSelect(ACCOUNTS.labTech);
  await startDiagnostic(tech.actor, tech.ctx, order.id);
  return { orderId: order.id, encounterId: enc.id, doctor };
}

describe("integration: Phase 3F-3 lab/radiology validator separation (verifies H1)", () => {
  beforeEach(resetTestDb);

  it("a DIFFERENT validator can validate a technician's result", async () => {
    const { orderId } = await orderReadyForResult();
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "NFS normale");
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("validated");
  });

  it("a user holding BOTH enter + validate caps CANNOT validate their OWN entered result (4-eyes)", async () => {
    const { orderId } = await orderReadyForResult();
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    // One person granted both capabilities AT this hospital — rolesByHospital mirrors the override.
    const dual = {
      ...tech.actor,
      roles: ["technicien_diagnostic", "validateur_diagnostic"],
      rolesByHospital: { [tech.ctx.hospitalId]: ["technicien_diagnostic", "validateur_diagnostic"] },
    };
    await enterDiagnosticResult(dual, tech.ctx, orderId, "Résultat saisi par le même agent");
    // The same agent cannot validate their own entry — server-side guard (+ DB NOT enteredById).
    await expect(validateDiagnosticResult(dual, tech.ctx, orderId)).rejects.toThrow(/différent/i);
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("result_entered");
    // A DIFFERENT validator can still validate it.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect((await prisma.diagnosticOrder.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("validated");
  });

  it("the doctor cannot see an UNVALIDATED result, but sees it once validated (visibility gate)", async () => {
    const { orderId, doctor } = await orderReadyForResult();
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "Hb 12.5 g/dL");
    // Before validation, the doctor's view strips the result text.
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId))!.resultText).toBeNull();
    // The technician (staff) does see it.
    expect((await getDiagnosticOrder(tech.actor, tech.ctx, orderId))!.resultText).toContain("Hb");
    // After validation, the doctor can see it.
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await validateDiagnosticResult(validator.actor, validator.ctx, orderId);
    expect((await getDiagnosticOrder(doctor.actor, doctor.ctx, orderId))!.resultText).toContain("Hb");
  });

  it("cross-hospital validation is blocked (per-hospital RBAC)", async () => {
    const { orderId } = await orderReadyForResult();
    const tech = await loginAndSelect(ACCOUNTS.labTech);
    await enterDiagnosticResult(tech.actor, tech.ctx, orderId, "Résultat");
    const validator = await loginAndSelect(ACCOUNTS.labValidator);
    await expect(
      validateDiagnosticResult(validator.actor, { ...validator.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" }, orderId),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
