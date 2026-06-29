import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  assignEncounterService,
  changeEncounterStatus,
  createPatientForActor,
  getEncounter,
  getEncounterStatusHistory,
  getPatientTimeline,
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

describe("integration: Phase 1A Batch 1B — encounter lifecycle", () => {
  beforeEach(resetTestDb);

  async function anEncounter() {
    const { actor, ctx, patient } = await aPatient();
    const enc = await openEncounter(actor, ctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "Fièvre",
    });
    return { actor, ctx, patient, enc };
  }

  it("open → closed is allowed, sets closedAt, and is audited", async () => {
    const { actor, ctx, enc } = await anEncounter();
    const closed = await changeEncounterStatus(actor, ctx, enc.id, "closed");
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).not.toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { action: "encounter.status_change", entityId: enc.id },
    });
    expect(audit?.summary).toContain("Ouverte → Clôturée");
  });

  it("rejects an invalid transition (closed → open) server-side", async () => {
    const { actor, ctx, enc } = await anEncounter();
    await changeEncounterStatus(actor, ctx, enc.id, "closed");
    await expect(changeEncounterStatus(actor, ctx, enc.id, "open")).rejects.toThrow(
      /Transition de statut invalide/,
    );
    // Status unchanged; no spurious extra status-change audit for the rejected attempt.
    const fresh = await getEncounter(actor, ctx, enc.id);
    expect(fresh?.status).toBe("closed");
    expect(
      await prisma.auditLog.count({ where: { action: "encounter.status_change", entityId: enc.id } }),
    ).toBe(1);
  });

  it("status history reconstructs from append-only audit (create → assign → close)", async () => {
    const { actor, ctx, enc } = await anEncounter();
    await assignEncounterService(actor, ctx, enc.id, "Cardiologie");
    await changeEncounterStatus(actor, ctx, enc.id, "closed");
    const history = await getEncounterStatusHistory(actor, ctx, enc.id);
    expect(history.map((h) => h.action)).toEqual([
      "encounter.create",
      "encounter.assign",
      "encounter.status_change",
    ]);
    // Assignment is recorded on the encounter itself.
    const fresh = await getEncounter(actor, ctx, enc.id);
    expect(fresh?.serviceLabel).toBe("Cardiologie");
  });

  it("read-only timeline is composed and hospital-scoped", async () => {
    const { actor, ctx, patient, enc } = await anEncounter();
    await changeEncounterStatus(actor, ctx, enc.id, "closed");
    const timeline = await getPatientTimeline(actor, ctx, patient.id);
    const types = timeline.map((t) => t.type);
    expect(types).toContain("patient_registered");
    expect(types).toContain("encounter_opened");
    expect(types).toContain("encounter_closed");
    // A director in another hospital must not see this patient's timeline.
    const other = await loginAndSelect(ACCOUNTS.director);
    await expect(
      getPatientTimeline(other.actor, { ...other.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" }, patient.id),
    ).rejects.toThrow();
  });

  it("director (read-only) cannot change encounter status", async () => {
    const { enc } = await anEncounter();
    const dir = await loginAndSelect(ACCOUNTS.director);
    await expect(
      changeEncounterStatus(dir.actor, dir.ctx, enc.id, "closed"),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
