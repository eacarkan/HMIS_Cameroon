import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { prisma, findConfigurationTemplateByCode } from "@/server/db";
import {
  selectHospital,
  resolveHospitalContext,
  getConfigurationCompleteness,
  recomputeConfigurationCompleteness,
  listAccessibleHospitalCompleteness,
  compareTwoHospitals,
  applyTemplate,
  overrideInstanceSetting,
  listTemplateApplications,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

/**
 * Phase 3A — multi-hospital configuration foundation (DB-backed). Proves: Bertoua is fully
 * configured and Ebolowa starts low; applying the SAME reference template raises Ebolowa without
 * a code change while the two still differ by identity (data); cross-hospital config is isolated;
 * and RBAC + audit hold. Synthetic data only — configuration, never patient data.
 */
const BERTOUA = "hosp-hrb-demo";
const EBOLOWA = "hosp-hre-ebo";

async function ebolowaCtxFor(email: string) {
  const actor = await actorFor(email);
  const ctx = await selectHospital(actor, EBOLOWA);
  return { actor, ctx };
}

describe("integration: Phase 3A configuration foundation", () => {
  beforeEach(resetTestDb);

  it("Bertoua is fully configured (100%) while Ebolowa starts low", async () => {
    const { actor: bAdmin, ctx: bCtx } = await loginAndSelect(ACCOUNTS.admin);
    const bertoua = await getConfigurationCompleteness(bAdmin, bCtx);
    expect(bertoua.percent).toBe(100);
    expect(bertoua.ready).toBe(true);

    const { actor: eAdmin, ctx: eCtx } = await ebolowaCtxFor(ACCOUNTS.admin);
    const ebolowa = await getConfigurationCompleteness(eAdmin, eCtx);
    expect(ebolowa.percent).toBeLessThan(40);
    const missing = ebolowa.categories.filter((c) => !c.configured).map((c) => c.key);
    expect(missing).toContain("departments_services");
    expect(missing).toContain("tariffs");
  });

  it("applying the Bertoua reference template raises Ebolowa WITHOUT a code change", async () => {
    const { actor, ctx } = await ebolowaCtxFor(ACCOUNTS.admin);
    const before = await getConfigurationCompleteness(actor, ctx);

    const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
    expect(tpl).not.toBeNull();
    const result = await applyTemplate(actor, ctx, tpl!.id);
    expect(result.createdCount).toBeGreaterThan(0);

    const after = await getConfigurationCompleteness(actor, ctx);
    expect(after.percent).toBeGreaterThan(before.percent);
    // The structural categories the template fills are now configured.
    const byKey = new Map(after.categories.map((c) => [c.key, c.configured]));
    expect(byKey.get("departments_services")).toBe(true);
    expect(byKey.get("outpatient_services")).toBe(true);
    expect(byKey.get("wards")).toBe(true);
    expect(byKey.get("pharmacy")).toBe(true);
    expect(byKey.get("lab_radiology")).toBe(true);
    expect(byKey.get("document_headers")).toBe(true);

    // A config.template.applied audit is recorded for Ebolowa.
    const applied = await prisma.auditLog.count({
      where: { hospitalId: EBOLOWA, action: "config.template.applied" },
    });
    expect(applied).toBe(1);
    const history = await listTemplateApplications(actor, ctx);
    expect(history).toHaveLength(1);
    expect(history[0].templateCode).toBe("TPL-BERTOUA-REF");
  });

  it("Bertoua and Ebolowa share structure yet differ by identity (data, not code)", async () => {
    const admin = await actorFor(ACCOUNTS.admin);
    const eCtx = await selectHospital(admin, EBOLOWA);
    const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
    await applyTemplate(admin, eCtx, tpl!.id);

    const comparison = await compareTwoHospitals(admin, BERTOUA, EBOLOWA);
    // Same structural completeness for the templated categories...
    for (const key of ["departments_services", "outpatient_services", "wards", "pharmacy"]) {
      const row = comparison.rows.find((r) => r.key === key);
      expect(row?.a).toBe(true);
      expect(row?.b).toBe(true);
    }
    // ...but the two hospitals are distinct instances with their own identities.
    expect(comparison.reference.name).not.toBe(comparison.candidate.name);
    expect(comparison.candidate.code).toBe("HRE-EBO");

    // The applied departments are SEPARATE rows scoped to Ebolowa (same codes, different ids).
    const bertouaDepts = await prisma.department.findMany({ where: { hospitalId: BERTOUA } });
    const ebolowaDepts = await prisma.department.findMany({ where: { hospitalId: EBOLOWA } });
    expect(ebolowaDepts.length).toBeGreaterThan(0);
    const overlapIds = bertouaDepts
      .map((d) => d.id)
      .filter((id) => ebolowaDepts.map((e) => e.id).includes(id));
    expect(overlapIds).toHaveLength(0);
  });

  it("isolates configuration across hospitals (no cross-hospital read/write)", async () => {
    // A Bertoua-only actor cannot resolve an Ebolowa context at all.
    const cashier = await actorFor(ACCOUNTS.cashier);
    expect(await resolveHospitalContext(cashier, EBOLOWA)).toBeNull();
    await expect(selectHospital(cashier, EBOLOWA)).rejects.toThrow(/refusé/i);

    // Apply the template to Ebolowa, then confirm Bertoua's own config is untouched in count terms
    // (Bertoua keeps exactly its seeded departments; the apply only wrote Ebolowa rows).
    const admin = await actorFor(ACCOUNTS.admin);
    const eCtx = await selectHospital(admin, EBOLOWA);
    const bertouaDeptsBefore = await prisma.department.count({ where: { hospitalId: BERTOUA } });
    const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
    await applyTemplate(admin, eCtx, tpl!.id);
    const bertouaDeptsAfter = await prisma.department.count({ where: { hospitalId: BERTOUA } });
    expect(bertouaDeptsAfter).toBe(bertouaDeptsBefore);

    // The comparison only ever spans the actor's OWN hospitals.
    const accessible = await listAccessibleHospitalCompleteness(admin);
    const ids = accessible.map((h) => h.hospitalId).sort();
    expect(ids).toEqual([BERTOUA, EBOLOWA].sort());
    await expect(compareTwoHospitals(admin, BERTOUA, "hosp-hrn-nga")).rejects.toThrow(/périmètre/i);
  });

  it("enforces RBAC: a non-config role is denied and an authz.denied audit is written", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.cashier); // cashier lacks config.view
    const before = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    await expect(getConfigurationCompleteness(actor, ctx)).rejects.toBeInstanceOf(AuthorizationError);
    const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
    await expect(applyTemplate(actor, ctx, tpl!.id)).rejects.toBeInstanceOf(AuthorizationError);
    const after = await prisma.auditLog.count({ where: { action: "authz.denied" } });
    expect(after).toBeGreaterThan(before);
  });

  it("records config.completeness.recomputed and config.instance.updated for instance changes", async () => {
    const { actor, ctx } = await ebolowaCtxFor(ACCOUNTS.admin);
    await recomputeConfigurationCompleteness(actor, ctx);
    expect(
      await prisma.auditLog.count({ where: { hospitalId: EBOLOWA, action: "config.completeness.recomputed" } }),
    ).toBe(1);

    await overrideInstanceSetting(actor, ctx, "receipt.footer_note", "Site d'Ebolowa — note locale");
    expect(
      await prisma.auditLog.count({ where: { hospitalId: EBOLOWA, action: "config.instance.updated" } }),
    ).toBe(1);
    // The override is scoped to Ebolowa only.
    const onEbolowa = await prisma.setting.findFirst({
      where: { hospitalId: EBOLOWA, key: "receipt.footer_note" },
    });
    expect(onEbolowa?.value).toContain("Ebolowa");
  });

  it("denies a capability held only at ANOTHER hospital (no cross-hospital privilege escalation)", async () => {
    // Make the Bertoua cashier (caissier@Bertoua) ALSO an administrateur at Ebolowa — an asymmetric
    // multi-hospital member. Their cross-hospital role UNION now includes administrateur, but that
    // privilege must apply ONLY at Ebolowa. UserRole rows are NOT cleared by resetTestDb, so this
    // test creates the membership idempotently and removes it afterwards (no cross-test pollution).
    await prisma.userRole.deleteMany({ where: { userId: "user-solange-abena", hospitalId: EBOLOWA } });
    await prisma.userRole.create({
      data: { userId: "user-solange-abena", roleId: "role-administrateur", hospitalId: EBOLOWA },
    });
    try {
      const cashier = await actorFor(ACCOUNTS.cashier);
      expect(cashier.roles).toContain("administrateur"); // present in the global union…
      expect(cashier.rolesByHospital[BERTOUA] ?? []).not.toContain("administrateur"); // …but NOT at Bertoua

      const bCtx = await selectHospital(cashier, BERTOUA);
      const eCtx = await selectHospital(cashier, EBOLOWA);

      // At Bertoua the cashier holds only `caissier` → config.instance.manage is DENIED even though
      // the global union contains administrateur (granted at Ebolowa). An authz.denied audit is written.
      const before = await prisma.auditLog.count({ where: { hospitalId: BERTOUA, action: "authz.denied" } });
      await expect(
        overrideInstanceSetting(cashier, bCtx, "payment.modes", "especes"),
      ).rejects.toBeInstanceOf(AuthorizationError);
      const after = await prisma.auditLog.count({ where: { hospitalId: BERTOUA, action: "authz.denied" } });
      expect(after).toBe(before + 1);

      // At Ebolowa the cashier holds administrateur → config.instance.manage is ALLOWED.
      const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
      const result = await applyTemplate(cashier, eCtx, tpl!.id);
      expect(result.createdCount).toBeGreaterThan(0);
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: "user-solange-abena", hospitalId: EBOLOWA } });
    }
  });

  it("the reference template carries no hospital identity in document bodies (no identity leak on apply)", async () => {
    const { actor, ctx } = await ebolowaCtxFor(ACCOUNTS.admin);
    const tpl = await findConfigurationTemplateByCode("TPL-BERTOUA-REF");
    await applyTemplate(actor, ctx, tpl!.id);
    // After applying Bertoua's reference template, Ebolowa's document templates must NOT contain
    // Bertoua's name (the identity-bearing body is never templated; it stays per-instance).
    const ebolowaDocs = await prisma.documentTemplate.findMany({ where: { hospitalId: EBOLOWA } });
    expect(ebolowaDocs.length).toBeGreaterThan(0);
    for (const d of ebolowaDocs) {
      expect(d.body ?? "").not.toContain("Bertoua");
      expect(d.header ?? "").not.toContain("Bertoua");
    }
    // And the shared template itself carries no Bertoua identity in any document body.
    const content = tpl!.content as { documentTemplates: { body: string | null }[] };
    for (const doc of content.documentTemplates) {
      expect(doc.body ?? "").not.toContain("Bertoua");
    }
  });
});
