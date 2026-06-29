import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  addPatientIdentifier,
  createPatientForActor,
  findPatientDuplicatesForActor,
  getPatient,
  searchPatientsForActor,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const AISSATOU = {
  familyName: "BELLO",
  givenName: "Aïssatou",
  sex: "female" as const,
  dateOfBirth: new Date("1990-03-14"),
  phone: "+237 6 99 00 00 01",
  residence: "Bertoua — quartier Nkolbikon",
};

describe("integration: patient (06 §7, 07 §5)", () => {
  beforeEach(resetTestDb);

  it("search-before-create then create mints HRB-DEMO-P-2026-000001, scoped + audited", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);

    expect(await searchPatientsForActor(actor, ctx, "BELLO")).toHaveLength(0);

    const patient = await createPatientForActor(actor, ctx, AISSATOU);
    expect(patient.patientNumber).toBe("HRB-DEMO-P-2026-000001");
    expect(patient.hospitalId).toBe("hosp-hrb-demo");
    expect(patient.createdById).toBe(actor.id);

    expect(await searchPatientsForActor(actor, ctx, "BELLO")).toHaveLength(1);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "patient.create" },
    });
    expect(audit?.summary).toContain("Aïssatou BELLO");
    expect(audit?.hospitalId).toBe("hosp-hrb-demo");
  });

  it("director (read-only) cannot create a patient — blocked server-side + audited", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.director);
    await expect(
      createPatientForActor(actor, ctx, AISSATOU),
    ).rejects.toBeInstanceOf(AuthorizationError);
    expect(await prisma.patient.count()).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { action: "authz.denied" } }),
    ).toBe(1);
  });

  it("fetches patient detail (no encounters yet)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const created = await createPatientForActor(actor, ctx, AISSATOU);
    const detail = await getPatient(actor, ctx, created.id);
    expect(detail?.patientNumber).toBe("HRB-DEMO-P-2026-000001");
    expect(detail?.encounters).toEqual([]);
  });
});

describe("integration: Phase 1A Batch 1A — search filters", () => {
  beforeEach(resetTestDb);

  it("finds a patient by phone substring (hospital-scoped)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, AISSATOU);
    expect(await searchPatientsForActor(actor, ctx, { phone: "99 00 00 01" })).toHaveLength(1);
    expect(await searchPatientsForActor(actor, ctx, { phone: "00 00 99 99" })).toHaveLength(0);
  });

  it("finds a patient by administrative identifier value", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(actor, ctx, AISSATOU);
    await addPatientIdentifier(actor, ctx, patient.id, {
      identifierType: "carte_hospitaliere",
      value: "CH-2026-777",
    });
    expect(await searchPatientsForActor(actor, ctx, { identifier: "777" })).toHaveLength(1);
    expect(await searchPatientsForActor(actor, ctx, { identifier: "CH-2026-001" })).toHaveLength(0);
  });

  it("combines filters (name AND sex) and stays hospital-scoped", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, AISSATOU);
    expect(
      await searchPatientsForActor(actor, ctx, { query: "BELLO", sex: "female" }),
    ).toHaveLength(1);
    expect(
      await searchPatientsForActor(actor, ctx, { query: "BELLO", sex: "male" }),
    ).toHaveLength(0);
  });
});

describe("integration: Phase 1A Batch 1A — duplicate warning (no merge/block)", () => {
  beforeEach(resetTestDb);

  it("detects a likely duplicate by name + date of birth", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, AISSATOU);
    // Same name + DOB, different phone → still a name_dob match.
    const hits = await findPatientDuplicatesForActor(actor, ctx, {
      ...AISSATOU,
      phone: "+237 6 00 00 00 09",
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].basis).toBe("name_dob");
    expect(hits[0].patientNumber).toBe("HRB-DEMO-P-2026-000001");
  });

  it("returns no duplicates for a clearly different person", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, AISSATOU);
    const hits = await findPatientDuplicatesForActor(actor, ctx, {
      familyName: "NKOMO",
      givenName: "Pierre",
      sex: "male",
      dateOfBirth: new Date("1975-01-02"),
      phone: "+237 6 11 22 33 44",
      residence: null,
    });
    expect(hits).toHaveLength(0);
  });

  it("creating despite a warning still works and is audited — no merge", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const first = await createPatientForActor(actor, ctx, AISSATOU);
    // Second registration of the same identity, user overrode the warning.
    const second = await createPatientForActor(actor, ctx, AISSATOU, {
      basis: "name_dob",
      candidatePatientNumbers: [first.patientNumber],
    });
    // Two distinct patients exist — nothing was merged or blocked.
    expect(second.id).not.toBe(first.id);
    expect(await prisma.patient.count({ where: { hospitalId: ctx.hospitalId } })).toBe(2);
    // The duplicate-warning override is audited (hospital-scoped).
    const warn = await prisma.auditLog.findFirst({
      where: { action: "patient_duplicate.warning", hospitalId: ctx.hospitalId },
    });
    expect(warn).not.toBeNull();
    expect(warn?.entityId).toBe(second.id);
    expect(warn?.summary).toContain(first.patientNumber);
  });

  it("duplicate search is hospital-scoped (no cross-hospital leak)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    await createPatientForActor(actor, ctx, AISSATOU);
    // Same identity created directly in ANOTHER hospital must NOT be seen here.
    await prisma.patient.create({
      data: {
        hospitalId: "hosp-hrn-nga",
        patientNumber: "HRN-NGA-P-2026-000001",
        familyName: AISSATOU.familyName,
        givenName: AISSATOU.givenName,
        sex: AISSATOU.sex,
        dateOfBirth: AISSATOU.dateOfBirth,
        phone: AISSATOU.phone,
      },
    });
    const hits = await findPatientDuplicatesForActor(actor, ctx, AISSATOU);
    // Only the local (HRB-DEMO) patient is flagged.
    expect(hits).toHaveLength(1);
    expect(hits[0].patientNumber).toBe("HRB-DEMO-P-2026-000001");
  });
});
