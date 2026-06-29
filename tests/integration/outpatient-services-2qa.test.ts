import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  type AuthenticatedActor,
  deactivateServiceUnit,
  listActiveOutpatientConsultationServices,
  listServiceCatalogue,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const OTHER = "hosp-hrn-nga";

describe("integration: Phase 2 QA — outpatient visit service picker", () => {
  beforeEach(resetTestDb);

  it("returns ONLY active OUTPATIENT services that accept consultation", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const services = await listActiveOutpatientConsultationServices(actor, ctx);
    expect(services.length).toBeGreaterThanOrEqual(5);
    expect(
      services.every((s) => s.type === "OUTPATIENT" && s.isActive && s.acceptsConsultation),
    ).toBe(true);
    expect(services.some((s) => s.code === "SRV-MED-GEN")).toBe(true); // Médecine générale
  });

  it("excludes support services (Cashier/Pharmacy/Lab/Imaging/Reception) and inpatient wards", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const codes = (await listActiveOutpatientConsultationServices(actor, ctx)).map((s) => s.code);
    for (const excluded of [
      "SRV-CAISSE", // Cashier
      "SRV-PHARMACIE", // Pharmacy
      "SRV-LABO", // Laboratory
      "SRV-IMAGERIE", // Medical Imaging
      "SRV-ACCUEIL", // Reception
      "SRV-MED-INTERNE", // inpatient ward
      "SRV-MATERNITE",
      "SRV-CHIR-HOSP",
      "SRV-PEDIA-HOSP",
    ]) {
      expect(codes).not.toContain(excluded);
    }
  });

  it("excludes a deactivated outpatient service", async () => {
    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    const dentaire = (await listServiceCatalogue(adm, actx)).find((s) => s.code === "SRV-DENTAIRE")!;
    await deactivateServiceUnit(adm, actx, dentaire.id);

    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception);
    const codes = (await listActiveOutpatientConsultationServices(actor, ctx)).map((s) => s.code);
    expect(codes).not.toContain("SRV-DENTAIRE");
  });

  it("excludes outpatient consultation services from OTHER hospitals (hospital scoping)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.reception); // HRB
    await prisma.serviceUnit.create({
      data: {
        hospitalId: OTHER,
        code: "OTHER-OUT",
        name: "Autre",
        nameFr: "Autre",
        type: "OUTPATIENT",
        acceptsConsultation: true,
        isActive: true,
      },
    });
    const services = await listActiveOutpatientConsultationServices(actor, ctx);
    expect(services.every((s) => s.hospitalId === ctx.hospitalId)).toBe(true);
    expect(services.some((s) => s.code === "OTHER-OUT")).toBe(false);
  });

  it("requires the service.config.view capability (denies an actor without it)", async () => {
    const { actor: rec, ctx } = await loginAndSelect(ACCOUNTS.reception);
    // A real seeded user id (so the authz-denied audit FK is satisfied) but stripped of roles.
    const noRoleActor: AuthenticatedActor = { ...rec, roles: [] };
    await expect(
      listActiveOutpatientConsultationServices(noRoleActor, ctx),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
