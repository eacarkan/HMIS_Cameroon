import { beforeEach, describe, expect, it } from "vitest";

import {
  auditDobValidationFailure,
  correctPatientIdentity,
  createTemporaryPatient,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3F-5 — Identity / DOB / temporary-patient numbering hardening (doc 34 §13). DB-backed
 * behaviours: concurrency-safe temporary numbering (unique IDs under concurrent creation, backed by
 * the partial unique index `Patient_temporary_identifier_unique` + P2002 retry), the estimated-age
 * path preserved, the audit retaining the original temporary ID on identity correction, and the
 * `patient.dob_validation_failed` audit. The strict YYYY-MM-DD / future / >130y DOB rejections are
 * unit-tested (`validateAgeInput` / `parseStrictDob`). Synthetic data only.
 */
const HRB = "hosp-hrb-demo";

describe("integration: Phase 3F-5 identity / temp-numbering hardening", () => {
  beforeEach(resetTestDb);

  it("CONCURRENT temporary-patient creation yields unique identifiers (no duplicates)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const created = await Promise.all(
      Array.from({ length: 6 }, () =>
        createTemporaryPatient(reception.actor, reception.ctx, { sex: "male" }),
      ),
    );
    const ids = created.map((p) => p.temporaryIdentifier);
    expect(new Set(ids).size).toBe(6); // all distinct
    expect(ids.every((id) => id?.startsWith("Inconnu_"))).toBe(true);
    // The DB agrees: six distinct temporary identifiers for the hospital.
    const rows = await prisma.patient.findMany({
      where: { hospitalId: HRB, isTemporaryIdentity: true },
      select: { temporaryIdentifier: true },
    });
    expect(new Set(rows.map((r) => r.temporaryIdentifier)).size).toBe(6);
  });

  it("the estimated-age path is preserved on a temporary patient", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createTemporaryPatient(reception.actor, reception.ctx, { sex: "female", estimatedAge: 40 });
    expect(patient.isEstimatedAge).toBe(true);
    expect(patient.estimatedAge).toBe(40);
    // Estimated DOB is 1 January of the approximate birth year (UTC).
    expect(patient.dateOfBirth.getUTCMonth()).toBe(0);
    expect(patient.dateOfBirth.getUTCDate()).toBe(1);
  });

  it("identity correction retains the original temporary ID in the audit (and never changes it)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    const temp = await createTemporaryPatient(reception.actor, reception.ctx, { sex: "male" });
    const originalTempId = temp.temporaryIdentifier!;
    const corrected = await correctPatientIdentity(reception.actor, reception.ctx, temp.id, {
      familyName: "MBALLA", givenName: "Jean", sex: "male", dateOfBirth: new Date("1990-03-14"), phone: null,
    });
    expect(corrected).not.toBeNull();
    // The temporary identifier is preserved on the record; the patient is no longer flagged temporary.
    expect(corrected!.temporaryIdentifier).toBe(originalTempId);
    expect(corrected!.isTemporaryIdentity).toBe(false);
    // The audit retains the original temporary ID.
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "patient.identity_updated", entityId: temp.id },
    });
    expect(audit.summary).toContain(originalTempId);
  });

  it("a rejected DOB is auditable via patient.dob_validation_failed", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await auditDobValidationFailure(reception.actor, reception.ctx, "format AAAA-MM-JJ invalide");
    const audits = await prisma.auditLog.findMany({
      where: { hospitalId: HRB, action: "patient.dob_validation_failed" },
    });
    expect(audits.length).toBe(1);
    expect(audits[0].summary).toMatch(/AAAA-MM-JJ/);
  });
});
