import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createPatientForActor,
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
