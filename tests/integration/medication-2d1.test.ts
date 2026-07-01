import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  createMedication,
  deactivateMedication,
  listActiveMedications,
  listMedicationCatalogue,
  reactivateMedication,
  updateMedication,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const OTHER = "hosp-hrn-nga";

const MED = {
  code: "MED-TEST-1",
  nameFr: "Médicament Test",
  nameEn: "Test Medication",
  form: "Comprimé",
  unit: "comprimé",
  strength: "100 mg",
};

describe("integration: Phase 2D-1 — medication catalogue", () => {
  beforeEach(resetTestDb);

  it("seeds a synthetic catalogue (active list non-empty, includes Paracétamol)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const active = await listActiveMedications(actor, ctx);
    expect(active.length).toBeGreaterThanOrEqual(6);
    expect(active.some((m) => m.code === "MED-PARA-500")).toBe(true);
    expect(active.every((m) => m.isActive)).toBe(true);
  });

  it("admin creates a medication (audited); duplicate code rejected", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const med = await createMedication(actor, ctx, MED);
    expect(med.nameFr).toBe("Médicament Test");
    expect(med.isActive).toBe(true);
    const audit = await prisma.auditLog.findFirst({
      where: { action: "medication.created", entityId: med.id },
    });
    expect(audit?.summary).toContain("MED-TEST-1");

    await expect(createMedication(actor, ctx, MED)).rejects.toThrow(/existe déjà/);
  });

  it("admin updates, deactivates and reactivates a medication", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const med = await createMedication(actor, ctx, MED);

    const updated = await updateMedication(actor, ctx, med.id, { strength: "200 mg" });
    expect(updated!.strength).toBe("200 mg");

    await deactivateMedication(actor, ctx, med.id);
    const activeCodes = (await listActiveMedications(actor, ctx)).map((m) => m.code);
    expect(activeCodes).not.toContain("MED-TEST-1");
    const allCodes = (await listMedicationCatalogue(actor, ctx)).map((m) => m.code);
    expect(allCodes).toContain("MED-TEST-1"); // still in the catalogue (soft state)

    await reactivateMedication(actor, ctx, med.id);
    expect((await listActiveMedications(actor, ctx)).some((m) => m.code === "MED-TEST-1")).toBe(true);
  });

  it("rejects an invalid (empty-name) medication", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createMedication(actor, ctx, { ...MED, nameFr: "  " }),
    ).rejects.toThrow(/français/);
  });

  it("RBAC: doctor and pharmacist VIEW the catalogue but cannot MANAGE it", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    expect((await listActiveMedications(doctor.actor, doctor.ctx)).length).toBeGreaterThan(0);
    await expect(createMedication(doctor.actor, doctor.ctx, MED)).rejects.toBeInstanceOf(
      AuthorizationError,
    );

    const pharmacist = await loginAndSelect(ACCOUNTS.pharmacist);
    expect((await listActiveMedications(pharmacist.actor, pharmacist.ctx)).length).toBeGreaterThan(0);
    await expect(
      createMedication(pharmacist.actor, pharmacist.ctx, MED),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("RBAC: reception cannot even view the catalogue (no medication.view)", async () => {
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      listMedicationCatalogue(reception.actor, reception.ctx),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("hospital scoping: a medication in ANOTHER hospital is not listed here", async () => {
    await prisma.medication.create({
      data: {
        hospitalId: OTHER,
        code: "MED-OTHER",
        nameFr: "Autre",
        nameEn: "Other",
        form: "Comprimé",
        unit: "comprimé",
      },
    });
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin); // HRB
    const codes = (await listMedicationCatalogue(actor, ctx)).map((m) => m.code);
    expect(codes).not.toContain("MED-OTHER");
  });
});
