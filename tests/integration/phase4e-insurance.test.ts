import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createClaimDraftForActor,
  createCoverageProfileForActor,
  createInvoice,
  createPatientForActor,
  createPayerForActor,
  decidePreAuthForActor,
  getInsuranceAdmin,
  linkPatientCoverageForActor,
  openEncounter,
  requestPreAuthForActor,
  setEligibilityPlaceholderForActor,
  transitionClaimForActor,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 4E — insurance / mutuelle foundation (DB-backed). Manual only: payer registry (admin) +
 * coverage/pre-auth/claim workflow (finance). Proves hospital-scoping + RBAC (payer.manage vs
 * claim.manage; clinical + cross-hospital denied), the manual claim state machine (no skipping / no
 * auto-submission), billing linkage, eligibility PLACEHOLDER, and audit. Synthetic only.
 */
const HRB = "hosp-hrb-demo";
const OTHER = "hosp-hrn-nga";

async function coverageAndInvoice() {
  const admin = await loginAndSelect(ACCOUNTS.admin);
  const payer = await createPayerForActor(admin.actor, admin.ctx, { code: "CNPS", name: "CNPS", kind: "STATE" });
  await createCoverageProfileForActor(admin.actor, admin.ctx, { payerId: payer.id, code: "STD", name: "Standard", coveragePercent: 80 });

  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "ASSUR", givenName: "Probe", sex: "male", dateOfBirth: new Date("1990-01-01"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 3000, quantity: 1 }]);
  const coverage = await linkPatientCoverageForActor(cashier.actor, cashier.ctx, { patientId: patient.id, payerId: payer.id, memberNumber: "M-001" });
  return { admin, cashier, payer, patient, invoice, coverage };
}

describe("integration: Phase 4E insurance / mutuelle", () => {
  beforeEach(resetTestDb);

  it("an admin creates a payer + coverage profile (hospital-scoped, audited)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const payer = await createPayerForActor(admin.actor, admin.ctx, { code: "CNPS", name: "CNPS", kind: "STATE" });
    expect(payer.hospitalId).toBe(HRB);
    await createCoverageProfileForActor(admin.actor, admin.ctx, { payerId: payer.id, code: "STD", name: "Standard", coveragePercent: 80 });
    expect(await prisma.coverageProfile.count({ where: { hospitalId: HRB } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "payer.created" } })).toBe(1);
  });

  it("coverage link + eligibility placeholder + a billing-linked claim through the MANUAL state machine", async () => {
    const { cashier, invoice, coverage } = await coverageAndInvoice();
    expect(coverage.eligibilityStatus).toBe("UNKNOWN");
    await setEligibilityPlaceholderForActor(cashier.actor, cashier.ctx, coverage.id, "ELIGIBLE_PLACEHOLDER");
    expect((await prisma.patientCoverage.findUniqueOrThrow({ where: { id: coverage.id } })).eligibilityStatus).toBe("ELIGIBLE_PLACEHOLDER");

    const claim = await createClaimDraftForActor(cashier.actor, cashier.ctx, { patientCoverageId: coverage.id, invoiceId: invoice.id, amountClaimed: 2400 });
    expect(claim.status).toBe("DRAFT");
    expect(claim.invoiceId).toBe(invoice.id); // billing-linked
    // Manual forward path only — no skipping.
    await expect(transitionClaimForActor(cashier.actor, cashier.ctx, claim.id, "ACCEPTED")).rejects.toThrow(/invalide/i);
    await transitionClaimForActor(cashier.actor, cashier.ctx, claim.id, "SUBMITTED_PLACEHOLDER");
    await transitionClaimForActor(cashier.actor, cashier.ctx, claim.id, "UNDER_REVIEW");
    await transitionClaimForActor(cashier.actor, cashier.ctx, claim.id, "ACCEPTED");
    expect((await prisma.claimDraft.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe("ACCEPTED");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "claim.status_changed" } })).toBe(3);
  });

  it("a pre-authorization is requested and decided manually (audited)", async () => {
    const { cashier, coverage } = await coverageAndInvoice();
    const pa = await requestPreAuthForActor(cashier.actor, cashier.ctx, { patientCoverageId: coverage.id, description: "IRM lombaire" });
    expect(pa.status).toBe("REQUESTED");
    await decidePreAuthForActor(cashier.actor, cashier.ctx, pa.id, { decision: "approve", reason: "OK" });
    expect((await prisma.preAuthorizationRequest.findUniqueOrThrow({ where: { id: pa.id } })).status).toBe("APPROVED");
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "preauth.requested" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "preauth.decided" } })).toBe(1);
  });

  it("a claim cannot link an invoice belonging to a DIFFERENT patient than the coverage", async () => {
    const { cashier, payer, coverage } = await coverageAndInvoice();
    // A second patient in the same hospital, with their own encounter + invoice.
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const other = await createPatientForActor(reception.actor, reception.ctx, {
      familyName: "AUTRE", givenName: "Patient", sex: "female", dateOfBirth: new Date("1985-05-05"), phone: null, residence: null,
    });
    const otherEnc = await openEncounter(reception.actor, reception.ctx, other.id, { serviceLabel: "Médecine générale", reason: "Autre" });
    const otherInvoice = await createInvoice(cashier.actor, cashier.ctx, otherEnc.id, [{ label: "Consultation", unitAmount: 3000, quantity: 1 }]);
    // The coverage is patient ASSUR's; the invoice is patient AUTRE's → refused.
    await expect(
      createClaimDraftForActor(cashier.actor, cashier.ctx, { patientCoverageId: coverage.id, invoiceId: otherInvoice.id, amountClaimed: 1000 }),
    ).rejects.toThrow(/autre patient/i);
    expect(await prisma.claimDraft.count({ where: { hospitalId: HRB } })).toBe(0);
    expect(payer.hospitalId).toBe(HRB);
  });

  it("RBAC: a clinical role is denied; a non-payer-manager cannot create a payer; cross-hospital denied", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getInsuranceAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);
    // The cashier holds claim.manage but NOT payer.manage.
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(createPayerForActor(cashier.actor, cashier.ctx, { code: "X", name: "x", kind: "k" })).rejects.toBeInstanceOf(AuthorizationError);
    // Cross-hospital payer creation denied.
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createPayerForActor(admin.actor, { ...admin.ctx, hospitalId: OTHER, code: "HRN-NGA", name: "Autre" }, { code: "Y", name: "y", kind: "k" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
