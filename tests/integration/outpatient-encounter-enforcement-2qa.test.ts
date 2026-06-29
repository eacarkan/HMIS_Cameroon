import { beforeEach, describe, expect, it } from "vitest";

import {
  assignEncounterService,
  createPatientForActor,
  deactivateServiceUnit,
  listServiceCatalogue,
  openEncounter,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

// Phase 2 QA (follow-up) — UI hiding is not security. These tests assert that the SERVER
// (openEncounter / assignEncounterService) enforces "active OUTPATIENT service that accepts
// consultation", rejecting any tampered/manual serviceLabel or code (cashier, pharmacy, lab,
// imaging, reception, inpatient ward, inactive, or another hospital's service).

const OTHER = "hosp-hrn-nga";
const INVALID = /Service de consultation externe invalide/;

async function aReceptionPatient() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "ENCQA",
    givenName: "Test",
    sex: "male",
    dateOfBirth: new Date("1990-01-01"),
    phone: null,
    residence: null,
  });
  return { actor: reception.actor, ctx: reception.ctx, patient };
}

describe("integration: Phase 2 QA — server-side outpatient encounter enforcement", () => {
  beforeEach(resetTestDb);

  describe("openEncounter", () => {
    it("accepts an active OUTPATIENT consultation service by label and links serviceUnitId", async () => {
      const { actor, ctx, patient } = await aReceptionPatient();
      const enc = await openEncounter(actor, ctx, patient.id, {
        serviceLabel: "Médecine générale",
        reason: "Fièvre",
      });
      expect(enc.serviceLabel).toBe("Médecine générale");
      const svc = await prisma.serviceUnit.findFirst({
        where: { hospitalId: ctx.hospitalId, code: "SRV-MED-GEN" },
      });
      expect(enc.serviceUnitId).toBe(svc!.id);
    });

    it("accepts an outpatient service submitted by CODE and stores the canonical name", async () => {
      const { actor, ctx, patient } = await aReceptionPatient();
      const enc = await openEncounter(actor, ctx, patient.id, {
        serviceLabel: "SRV-MED-GEN",
        reason: "x",
      });
      // The raw code is normalized to the canonical service name on the record.
      expect(enc.serviceLabel).toBe("Médecine générale");
      expect(enc.serviceUnitId).not.toBeNull();
    });

    it.each([
      ["Caisse", "SRV-CAISSE"],
      ["Pharmacie", "SRV-PHARMACIE"],
      ["Laboratoire", "SRV-LABO"],
      ["Imagerie médicale", "SRV-IMAGERIE"],
      ["Accueil", "SRV-ACCUEIL"],
    ])("rejects support service %s / %s (no encounter created)", async (label, code) => {
      const { actor, ctx, patient } = await aReceptionPatient();
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: label, reason: "x" }),
      ).rejects.toThrow(INVALID);
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: code, reason: "x" }),
      ).rejects.toThrow(INVALID);
      expect(await prisma.encounter.count({ where: { patientId: patient.id } })).toBe(0);
    });

    it("rejects an inpatient ward even though it accepts consultation (type guard, not just the flag)", async () => {
      const { actor, ctx, patient } = await aReceptionPatient();
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: "Maternité", reason: "x" }),
      ).rejects.toThrow(INVALID);
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: "SRV-MED-INTERNE", reason: "x" }),
      ).rejects.toThrow(INVALID);
    });

    it("rejects a deactivated outpatient service", async () => {
      const adm = await loginAndSelect(ACCOUNTS.admin);
      const dentaire = (await listServiceCatalogue(adm.actor, adm.ctx)).find(
        (s) => s.code === "SRV-DENTAIRE",
      )!;
      await deactivateServiceUnit(adm.actor, adm.ctx, dentaire.id);

      const { actor, ctx, patient } = await aReceptionPatient();
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: "Dentaire", reason: "x" }),
      ).rejects.toThrow(INVALID);
    });

    it("rejects an outpatient service that belongs to ANOTHER hospital (hospital scoping)", async () => {
      await prisma.serviceUnit.create({
        data: {
          hospitalId: OTHER,
          code: "OTHER-OUT",
          name: "Autre consultation",
          nameFr: "Autre consultation",
          type: "OUTPATIENT",
          acceptsConsultation: true,
          isActive: true,
        },
      });
      const { actor, ctx, patient } = await aReceptionPatient(); // HRB
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: "Autre consultation", reason: "x" }),
      ).rejects.toThrow(INVALID);
      await expect(
        openEncounter(actor, ctx, patient.id, { serviceLabel: "OTHER-OUT", reason: "x" }),
      ).rejects.toThrow(INVALID);
    });
  });

  describe("assignEncounterService", () => {
    async function anOpenEncounter() {
      const { actor, ctx, patient } = await aReceptionPatient();
      const enc = await openEncounter(actor, ctx, patient.id, {
        serviceLabel: "Médecine générale",
        reason: "x",
      });
      return { actor, ctx, patient, enc };
    }

    it("allows re-assignment to another active outpatient consultation service", async () => {
      const { actor, ctx, enc } = await anOpenEncounter();
      const updated = await assignEncounterService(actor, ctx, enc.id, "Pédiatrie");
      expect(updated.serviceLabel).toBe("Pédiatrie");
      const svc = await prisma.serviceUnit.findFirst({
        where: { hospitalId: ctx.hospitalId, code: "SRV-PEDIATRIE" },
      });
      expect(updated.serviceUnitId).toBe(svc!.id);
    });

    it.each(["Caisse", "Pharmacie", "Laboratoire", "Imagerie médicale", "Maternité"])(
      "rejects re-assignment to %s and leaves serviceUnitId / serviceLabel unchanged",
      async (label) => {
        const { actor, ctx, enc } = await anOpenEncounter();
        const before = await prisma.encounter.findUnique({ where: { id: enc.id } });
        await expect(assignEncounterService(actor, ctx, enc.id, label)).rejects.toThrow(INVALID);
        const after = await prisma.encounter.findUnique({ where: { id: enc.id } });
        expect(after?.serviceUnitId).toBe(before?.serviceUnitId);
        expect(after?.serviceLabel).toBe("Médecine générale");
      },
    );

    it("records an audit ONLY on a successful re-assignment (not on a rejected one)", async () => {
      const { actor, ctx, enc } = await anOpenEncounter();
      await assignEncounterService(actor, ctx, enc.id, "Pédiatrie"); // success → audited
      await expect(assignEncounterService(actor, ctx, enc.id, "Caisse")).rejects.toThrow(INVALID); // rejected → not audited
      const assigns = await prisma.auditLog.count({
        where: { action: "encounter.assign", entityId: enc.id },
      });
      expect(assigns).toBe(1);
    });
  });
});
