import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createPatientForActor,
  openEncounter,
  recordConsultation,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

async function anEncounter() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: null,
    residence: null,
  });
  const encounter = await openEncounter(
    reception.actor,
    reception.ctx,
    patient.id,
    {
      serviceLabel: "Médecine générale",
      reason: "Fièvre",
    },
  );
  return { reception, encounter };
}

const CONSULT = {
  reason: "Fièvre et céphalées depuis 48 heures",
  clinicalNote: "Patiente consciente, état général conservé.",
  vitals: "Température 38,2 °C",
  provisionalDiagnosis: "Syndrome fébrile à explorer",
  recommendation: "Repos, hydratation.",
};

describe("integration: consultation (05 §4, 07 §7)", () => {
  beforeEach(resetTestDb);

  it("doctor records a finalized consultation linked to the encounter, audited", async () => {
    const { encounter } = await anEncounter();
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    const consultation = await recordConsultation(
      doctor.actor,
      doctor.ctx,
      encounter.id,
      CONSULT,
    );
    expect(consultation.encounterId).toBe(encounter.id);
    expect(consultation.hospitalId).toBe("hosp-hrb-demo");
    expect(consultation.status).toBe("finalized");
    expect(consultation.performedById).toBe(doctor.actor.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "consultation.create" },
    });
    expect(audit?.summary).toContain("consultation");
  });

  it("reception and cashier cannot record a consultation (server-side)", async () => {
    const { encounter, reception } = await anEncounter();
    await expect(
      recordConsultation(reception.actor, reception.ctx, encounter.id, CONSULT),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(
      recordConsultation(cashier.actor, cashier.ctx, encounter.id, CONSULT),
    ).rejects.toBeInstanceOf(AuthorizationError);

    expect(await prisma.consultation.count()).toBe(0);
  });
});
