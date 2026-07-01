import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { GATE7_CRITERIA, UAT_SCENARIO_LIBRARY } from "@/lib/uat-gate7";
import {
  getUatEvidence,
  recordUatExecution,
  setGate7Item,
  setGate7Signoff,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

/**
 * Phase 3E — UAT evidence + Gate 7 readiness (DB-backed). EVIDENCE ONLY: the readiness signal is
 * never an authorization and the report carries the disclaimer. Hospital-scoped, RBAC-enforced,
 * audited; sign-off is a placeholder (Director). Synthetic UAT only.
 */
const HRB = "hosp-hrb-demo";

describe("integration: Phase 3E UAT evidence + Gate 7 readiness", () => {
  beforeEach(resetTestDb);

  it("getUatEvidence establishes the scenario library + criteria and is NOT an authorization", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    const ev = await getUatEvidence(admin.actor, admin.ctx);
    expect(ev.scenarios.length).toBe(UAT_SCENARIO_LIBRARY.length);
    expect(ev.gate7.length).toBe(GATE7_CRITERIA.length);
    // THE KEY GUARANTEE (doc 34 §8.14): the report disclaims authorization.
    expect(ev.disclaimerFr).toMatch(/pas une autorisation/i);
    expect(ev.signal.authorized).toBe(false);
    // The library is established once (audited).
    expect(
      await prisma.auditLog.count({ where: { hospitalId: HRB, action: "uat.scenario_created" } }),
    ).toBe(1);
  });

  it("an admin records a UAT execution and updates a Gate 7 criterion (audited)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await recordUatExecution(admin.actor, admin.ctx, "UAT-REG", { status: "pass", notes: "OK" });
    await setGate7Item(admin.actor, admin.ctx, "trained_users", { status: "ready" });
    const ev = await getUatEvidence(admin.actor, admin.ctx);
    expect(ev.scenarios.find((s) => s.code === "UAT-REG")?.status).toBe("pass");
    expect(ev.gate7.find((g) => g.criterion === "trained_users")?.status).toBe("ready");
    expect(ev.uat.pass).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "uat.execution_recorded" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { hospitalId: HRB, action: "gate7.item_updated" } })).toBe(1);
  });

  it("the Director (not the admin) sets the sign-off PLACEHOLDERS (audited)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    // Admin manages criteria but is NOT a sign-off authority.
    await expect(
      setGate7Signoff(admin.actor, admin.ctx, "signed_uat", { directorSignoffPlaceholder: "X" }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const director = await loginAndSelect(ACCOUNTS.director);
    await setGate7Signoff(director.actor, director.ctx, "signed_uat", {
      directorSignoffPlaceholder: "Dr Directeur (placeholder)",
      minsanteSignoffPlaceholder: "Représentant MINSANTE (placeholder)",
    });
    const ev = await getUatEvidence(director.actor, director.ctx);
    const item = ev.gate7.find((g) => g.criterion === "signed_uat");
    expect(item?.directorSignoffPlaceholder).toContain("placeholder");
    expect(
      await prisma.auditLog.count({ where: { hospitalId: HRB, action: "gate7.signoff_placeholder_changed" } }),
    ).toBe(1);
  });

  it("a non-UAT role (cashier) cannot view the UAT evidence", async () => {
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    await expect(getUatEvidence(cashier.actor, cashier.ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("cross-hospital UAT recording is blocked (per-hospital RBAC)", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    await expect(
      recordUatExecution(
        admin.actor,
        { ...admin.ctx, hospitalId: "hosp-hrn-nga", code: "HRN-NGA", name: "Autre" },
        "UAT-REG",
        { status: "pass" },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});
