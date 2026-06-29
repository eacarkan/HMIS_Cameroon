import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma } from "@/server/db";
import {
  createPatientForActor,
  createServiceUnit,
  deactivateServiceUnit,
  listActiveServices,
  listServiceCatalogue,
  reactivateServiceUnit,
  reorderServices,
  setServiceEligibility,
  updateServiceUnit,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const OTHER = "hosp-hrn-nga";

describe("integration: Phase 2A service catalogue", () => {
  beforeEach(resetTestDb);

  it("seeds the Bertoua standard structure (typed, bilingual, ordered)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const cat = await listServiceCatalogue(actor, ctx);
    expect(cat.length).toBeGreaterThanOrEqual(14);

    const medGen = cat.find((s) => s.code === "SRV-MED-GEN");
    expect(medGen?.type).toBe("OUTPATIENT");
    expect(medGen?.nameFr).toBe("Médecine générale");
    expect(medGen?.nameEn).toBe("General Medicine");
    expect(medGen?.acceptsConsultation).toBe(true);

    const ward = cat.find((s) => s.code === "SRV-MATERNITE");
    expect(ward?.type).toBe("INPATIENT_WARD");
    expect(ward?.isInpatientWard).toBe(true);

    const orders = cat.map((s) => s.displayOrder);
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
  });

  it("admin creates / updates / deactivates / reactivates — each audited (service.*)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const created = await createServiceUnit(actor, ctx, {
      code: "SRV-TEST",
      nameFr: "Service test",
      nameEn: "Test service",
      type: "SUPPORT",
      displayOrder: 50,
    });
    expect(created.nameFr).toBe("Service test");

    await updateServiceUnit(actor, ctx, created.id, {
      code: "SRV-TEST",
      nameFr: "Service test modifié",
      type: "OUTPATIENT",
    });
    await deactivateServiceUnit(actor, ctx, created.id);
    const off = await prisma.serviceUnit.findUnique({ where: { id: created.id } });
    expect(off?.isActive).toBe(false);
    expect(off?.type).toBe("OUTPATIENT");

    await reactivateServiceUnit(actor, ctx, created.id);
    const on = await prisma.serviceUnit.findUnique({ where: { id: created.id } });
    expect(on?.isActive).toBe(true);

    for (const action of [
      "service.created",
      "service.updated",
      "service.deactivated",
      "service.reactivated",
    ]) {
      expect(await prisma.auditLog.count({ where: { action } })).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects an inconsistent flag↔type combination on create", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createServiceUnit(actor, ctx, {
        code: "SRV-BAD",
        nameFr: "Incohérent",
        type: "OUTPATIENT",
        isInpatientWard: true,
      }),
    ).rejects.toThrow();
  });

  it("setServiceEligibility toggles a flag, preserves the rest, audits eligibility_changed", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const labo = (await listServiceCatalogue(actor, ctx)).find((s) => s.code === "SRV-LABO")!;
    await setServiceEligibility(actor, ctx, labo.id, { supportsImaging: true });
    const after = await prisma.serviceUnit.findUnique({ where: { id: labo.id } });
    expect(after?.supportsImaging).toBe(true);
    expect(after?.supportsLab).toBe(true); // preserved
    expect(
      await prisma.auditLog.count({ where: { action: "service.eligibility_changed" } }),
    ).toBeGreaterThanOrEqual(1);
  });

  it("reorders the catalogue atomically and audits service.reordered", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    const ids = (await listServiceCatalogue(actor, ctx)).map((s) => s.id);
    const reversed = [...ids].reverse();
    await reorderServices(actor, ctx, reversed);
    const after = (await listServiceCatalogue(actor, ctx)).map((s) => s.id);
    expect(after).toEqual(reversed);
    expect(await prisma.auditLog.count({ where: { action: "service.reordered" } })).toBeGreaterThanOrEqual(1);
  });

  it("is hospital-scoped — another hospital's service is invisible and immutable here", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin); // HRB
    const other = await prisma.serviceUnit.create({
      data: { hospitalId: OTHER, code: "OTHER-SRV", name: "X", nameFr: "X", type: "SUPPORT" },
    });
    const cat = await listServiceCatalogue(actor, ctx);
    expect(cat.find((s) => s.id === other.id)).toBeUndefined();
    await expect(reorderServices(actor, ctx, [other.id])).rejects.toThrow();
    await expect(
      updateServiceUnit(actor, ctx, other.id, { code: "OTHER-SRV", nameFr: "Y", type: "SUPPORT" }),
    ).rejects.toThrow();
  });

  it("RBAC — non-admin cannot manage; reception may VIEW active services only", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      createServiceUnit(rec, rctx, { code: "SRV-NO", nameFr: "Non", type: "SUPPORT" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listServiceCatalogue(rec, rctx)).rejects.toBeInstanceOf(AuthorizationError);

    const active = await listActiveServices(rec, rctx);
    expect(active.length).toBeGreaterThanOrEqual(14);
    expect(active.every((s) => s.isActive)).toBe(true);
  });

  it("admin is de-scoped from clinical data entry (cannot create a patient)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      createPatientForActor(actor, ctx, {
        familyName: "X",
        givenName: "Y",
        sex: "male",
        dateOfBirth: new Date("1990-01-01"),
        phone: null,
        residence: null,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
