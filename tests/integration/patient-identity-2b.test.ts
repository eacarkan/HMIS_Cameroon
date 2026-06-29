import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  correctPatientIdentity,
  createPatientForActor,
  createTemporaryPatient,
  listDiagnosisCodes,
  openEncounter,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

describe("integration: Phase 2B patient identity + consultation", () => {
  beforeEach(resetTestDb);

  it("creates a temporary patient (Inconnu_YYMMDD_NN) and audits patient.temporary_created", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const p = await createTemporaryPatient(actor, ctx, { sex: "female", estimatedAge: 40 });
    expect(p.isTemporaryIdentity).toBe(true);
    expect(p.temporaryIdentifier).toMatch(/^Inconnu_\d{6}_\d{2}$/);
    expect(p.familyName).toBe("Inconnu");
    expect(p.isEstimatedAge).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { action: "patient.temporary_created" } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("identity correction clears the temp flag but PRESERVES the original temp ID in audit", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const temp = await createTemporaryPatient(actor, ctx, { sex: "male" });
    const tempId = temp.temporaryIdentifier!;

    await correctPatientIdentity(actor, ctx, temp.id, {
      familyName: "NDONGO",
      givenName: "Paul",
      sex: "male",
      dateOfBirth: new Date("1985-05-05"),
      phone: null,
    });

    const after = await prisma.patient.findUnique({ where: { id: temp.id } });
    expect(after?.isTemporaryIdentity).toBe(false);
    expect(after?.familyName).toBe("NDONGO");
    expect(after?.temporaryIdentifier).toBe(tempId); // immutable

    const audit = await prisma.auditLog.findFirst({
      where: { action: "patient.identity_updated", entityId: temp.id },
    });
    expect(audit?.summary).toContain(tempId); // original temporary ID retained forever
  });

  it("registers a patient by estimated age (guardian phone kept, flagged estimated)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const p = await createPatientForActor(actor, ctx, {
      familyName: "ABEGA",
      givenName: "Marie",
      sex: "female",
      dateOfBirth: new Date(Date.UTC(new Date().getFullYear() - 25, 0, 1)),
      phone: null,
      residence: null,
      guardianPhone: "237600000000",
      estimatedAge: 25,
      isEstimatedAge: true,
    });
    expect(p.isEstimatedAge).toBe(true);
    expect(p.guardianPhone).toBe("237600000000");
  });

  it("links a visit to the configured service when the label matches an active service", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(actor, ctx, {
      familyName: "ESSOMBA",
      givenName: "Jean",
      sex: "male",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(actor, ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "fièvre",
    });
    const stored = await prisma.encounter.findUnique({ where: { id: enc.id } });
    expect(stored?.serviceUnitId).not.toBeNull();
  });

  it("exposes the ICD-10 subset to a clinician; admin is de-scoped from creating patients", async () => {
    const { actor: doc, ctx: dctx } = await loginAndSelect(ACCOUNTS.doctor);
    const codes = await listDiagnosisCodes(doc, dctx);
    expect(codes.length).toBeGreaterThanOrEqual(10);
    expect(codes.some((c) => c.code === "B50")).toBe(true);

    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(createTemporaryPatient(adm, actx, { sex: "male" })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});
