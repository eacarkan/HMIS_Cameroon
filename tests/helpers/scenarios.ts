import {
  accrueEmergencyDebt,
  addDiagnosis,
  createClaimDraftForActor,
  createCoverageProfileForActor,
  createInvoice,
  createPatientForActor,
  createPayerForActor,
  flagEncounterEmergency,
  generateMatchCandidatesForActor,
  linkPatientCoverageForActor,
  openEncounter,
  recordConsultation,
  recordPayment,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "./actors";

/**
 * Phase 5C — synthetic-data factory. Deterministic, repeatable, hospital-scoped scenario builders that
 * exercise edge cases across the app (emergency debt, insurance claim, duplicate matching, a billed +
 * paid encounter) using the REAL services (so scoping/RBAC/audit all fire). 100% synthetic — every
 * record is fake demo data. Reused by demo seeding and the 5C reproducibility test.
 */

/** A consulted, invoiced, and fully-paid outpatient encounter (billing golden edge). */
export async function seedBilledEncounter(tag = "FAC") {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: `DEMO_${tag}`, givenName: "Facture", sex: "female", dateOfBirth: new Date("1988-03-03"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Bilan" });
  const doctor = await loginAndSelect(ACCOUNTS.doctor);
  const consult = await recordConsultation(doctor.actor, doctor.ctx, enc.id, {
    reason: "Bilan", clinicalNote: "RAS", vitals: null, provisionalDiagnosis: null, recommendation: null,
  });
  await addDiagnosis(doctor.actor, doctor.ctx, consult.id, { label: "Paludisme", code: "B50", isPrimary: true });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const invoice = await createInvoice(cashier.actor, cashier.ctx, enc.id, [{ label: "Consultation", unitAmount: 3000, quantity: 1 }]);
  await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 3000, method: "cash" });
  return { patient, encounter: enc, invoice };
}

/** An emergency-flagged encounter with an accrued outstanding debt (2H edge; treat-first-pay-later). */
export async function seedEmergencyDebt(tag = "URG") {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: `DEMO_${tag}`, givenName: "Urgence", sex: "male", dateOfBirth: new Date("1979-07-07"), phone: null, residence: null,
  });
  const enc = await openEncounter(reception.actor, reception.ctx, patient.id, { serviceLabel: "Médecine générale", reason: "Urgence" });
  await flagEncounterEmergency(reception.actor, reception.ctx, enc.id, true);
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const debt = await accrueEmergencyDebt(cashier.actor, cashier.ctx, { encounterId: enc.id, amount: 5000, source: "demo:urgence" });
  return { patient, encounter: enc, debt };
}

/** A payer + coverage + a billing-linked insurance claim draft (4E edge; manual only). */
export async function seedInsuranceClaim(tag = "ASS") {
  const { patient, invoice } = await seedBilledEncounter(tag);
  const admin = await loginAndSelect(ACCOUNTS.admin);
  const payer = await createPayerForActor(admin.actor, admin.ctx, { code: `CNPS${tag}`, name: "CNPS", kind: "STATE" });
  await createCoverageProfileForActor(admin.actor, admin.ctx, { payerId: payer.id, code: "STD", name: "Standard", coveragePercent: 80 });
  const cashier = await loginAndSelect(ACCOUNTS.cashier);
  const coverage = await linkPatientCoverageForActor(cashier.actor, cashier.ctx, { patientId: patient.id, payerId: payer.id, memberNumber: `M-${tag}` });
  const claim = await createClaimDraftForActor(cashier.actor, cashier.ctx, { patientCoverageId: coverage.id, invoiceId: invoice.id, amountClaimed: 2400 });
  return { payer, coverage, claim, patient, invoice };
}

/** Two matching patients + generated local match candidate(s) (4G edge; warning-only). */
export async function seedDuplicateMatch(tag = "DUP") {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const a = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: `DEMO_${tag}`, givenName: "Jumeau", sex: "male", dateOfBirth: new Date("1995-09-09"), phone: "690000001", residence: null,
  });
  const b = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: `demo_${tag}`, givenName: "jumeau", sex: "male", dateOfBirth: new Date("1995-09-09"), phone: null, residence: null,
  });
  const admin = await loginAndSelect(ACCOUNTS.admin);
  const result = await generateMatchCandidatesForActor(admin.actor, admin.ctx);
  return { patients: [a, b], created: result.created };
}
