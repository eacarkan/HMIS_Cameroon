import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { READINESS_CATEGORIES } from "@/lib/site-readiness";
import { getSiteReadiness, setReadinessItem, selectHospital } from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3C — Site readiness & deployment checklist (DB-backed). The full checklist always shows
 * (categories merged with stored items); managers update items (audited, hospital-scoped); the
 * supplier-dependent READY gate holds; directors / central viewer are read-only; cross-hospital
 * updates are denied. Status tracking only — no infrastructure work. Synthetic data only.
 */
const HRB = "hosp-hrb-demo";
const CENTRAL = "direction.regionale@hrb-demo.cm";

describe("integration: Phase 3C site-readiness checklist", () => {
  beforeEach(resetTestDb);

  it("returns the full checklist (all categories, default not_started) for a manager", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const view = await getSiteReadiness(admin.actor, admin.ctx);
    expect(view.items.length).toBe(READINESS_CATEGORIES.length);
    expect(view.items.every((i) => i.status === "not_started")).toBe(true);
    expect(view.summary.percentReady).toBe(0);
  });

  it("a manager updates an item — persisted, reflected in the rollup, and audited", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await setReadinessItem(admin.actor, admin.ctx, "training", { status: "ready", owner: "RH" });
    const view = await getSiteReadiness(admin.actor, admin.ctx);
    const training = view.items.find((i) => i.key === "training");
    expect(training?.status).toBe("ready");
    expect(training?.owner).toBe("RH");
    expect(view.summary.ready).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { hospitalId: HRB, action: "readiness.status_changed" } }),
    ).toBe(1);
  });

  it("a supplier-dependent item cannot be set READY without verifier + evidence", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      setReadinessItem(admin.actor, admin.ctx, "hardware", { status: "ready" }),
    ).rejects.toThrow(/fournisseur/i);
    // needs_validation is fine; ready with verifier + evidence is fine.
    await setReadinessItem(admin.actor, admin.ctx, "hardware", { status: "needs_validation" });
    await setReadinessItem(admin.actor, admin.ctx, "hardware", {
      status: "ready",
      verifier: "Prestataire X",
      evidenceNote: "PV de réception matériel",
    });
    const view = await getSiteReadiness(admin.actor, admin.ctx);
    expect(view.items.find((i) => i.key === "hardware")?.status).toBe("ready");
  });

  it("directors and the central viewer are read-only (view yes, manage no)", async () => {
    const director = await loginAndSelect(ACCOUNTS.director);
    await expect(getSiteReadiness(director.actor, director.ctx)).resolves.toBeTruthy();
    await expect(
      setReadinessItem(director.actor, director.ctx, "training", { status: "ready" }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const central = await actorFor(CENTRAL);
    const cCtx = await selectHospital(central, HRB);
    await expect(getSiteReadiness(central, cCtx)).resolves.toBeTruthy();
    await expect(setReadinessItem(central, cCtx, "training", { status: "ready" })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("a non-oversight role (cashier) cannot even view the checklist", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(getSiteReadiness(cashier.actor, cashier.ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cross-hospital readiness update is blocked (per-hospital RBAC)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      setReadinessItem(
        admin.actor,
        { ...admin.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" },
        "training",
        { status: "ready" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
