import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createPatientForActor,
  getEncounter,
  openEncounter,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

async function aPatient() {
  const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(actor, ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: null,
    residence: null,
  });
  return { actor, ctx, patient };
}

describe("integration: encounter (07 §6)", () => {
  beforeEach(resetTestDb);

  it("opening a visit mints HRB-DEMO-V-2026-000001, linked, open, audited", async () => {
    const { actor, ctx, patient } = await aPatient();
    const encounter = await openEncounter(actor, ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "Fièvre et céphalées depuis 48 heures",
    });
    expect(encounter.encounterNumber).toBe("HRB-DEMO-V-2026-000001");
    expect(encounter.patientId).toBe(patient.id);
    expect(encounter.hospitalId).toBe("hosp-hrb-demo");
    expect(encounter.status).toBe("open");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "encounter.create" },
    });
    expect(audit?.summary).toContain("HRB-DEMO-V-2026-000001");
  });

  it("cannot open a visit for a patient outside the active hospital", async () => {
    const { actor, ctx } = await aPatient();
    await expect(
      openEncounter(actor, ctx, "non-existent-patient", {
        serviceLabel: "Médecine générale",
        reason: "x",
      }),
    ).rejects.toThrow();
  });

  it("director (read-only) cannot open a visit", async () => {
    const { patient } = await aPatient();
    const dir = await loginAndSelect(ACCOUNTS.director);
    await expect(
      openEncounter(dir.actor, dir.ctx, patient.id, {
        serviceLabel: "Médecine générale",
        reason: "x",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("can fetch the encounter with its relations", async () => {
    const { actor, ctx, patient } = await aPatient();
    const opened = await openEncounter(actor, ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "Fièvre",
    });
    const fetched = await getEncounter(actor, ctx, opened.id);
    expect(fetched?.patient.patientNumber).toBe("HRB-DEMO-P-2026-000001");
    expect(fetched?.consultations).toEqual([]);
  });
});
