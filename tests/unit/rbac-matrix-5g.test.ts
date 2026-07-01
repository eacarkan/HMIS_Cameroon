import { describe, expect, it } from "vitest";

import { ROLE_CAPABILITIES } from "@/lib/rbac";
import { isLiveIntegrationEnabled } from "@/lib/integration/adapter";
import { isMpiLiveEnabled } from "@/lib/integration/mpi-adapter";

/**
 * Phase 5G — app-level access-review invariants (pure). These lock in the security posture reviewed in
 * 5G so a future capability grant that breaks it fails CI: the single cross-hospital capability, no
 * clinical/reception over-grant, and live external calls off by default.
 */
const roles = Object.keys(ROLE_CAPABILITIES);
const CLINICAL_OR_RECEPTION = ["medecin", "agent_accueil", "technicien_diagnostic", "validateur_diagnostic", "pharmacien", "pharmacien_chef"];
const PRIVILEGED = [
  "admin.manage", "user.manage", "config.manage", "config.template.manage", "config.instance.manage",
  "integration.system.manage", "integration.job.retry", "dhis2.mapping.manage", "dhis2.export.run",
  "external_result.import", "external_payment.reconcile", "payer.manage", "claim.manage",
  "analytics.report.manage", "patient_match.review", "patient_match.configure",
] as const;

describe("unit: Phase 5G access-review invariants", () => {
  it("`central.aggregate.view` is the ONLY cross-hospital capability, held only by superviseur_central", () => {
    const centralCaps = roles.flatMap((r) => ROLE_CAPABILITIES[r as keyof typeof ROLE_CAPABILITIES]).filter((c) => c.startsWith("central."));
    expect([...new Set(centralCaps)]).toEqual(["central.aggregate.view"]);
    const holders = roles.filter((r) => (ROLE_CAPABILITIES[r as keyof typeof ROLE_CAPABILITIES] as readonly string[]).includes("central.aggregate.view"));
    expect(holders).toEqual(["superviseur_central"]);
  });

  it("no clinical/reception role holds any privileged manage/admin capability", () => {
    for (const role of CLINICAL_OR_RECEPTION) {
      const caps = ROLE_CAPABILITIES[role as keyof typeof ROLE_CAPABILITIES] as readonly string[];
      const overGrant = PRIVILEGED.filter((p) => caps.includes(p));
      expect(overGrant, `${role} over-granted: ${overGrant.join(", ")}`).toEqual([]);
    }
  });

  it("privileged capabilities are held ONLY by administrateur / caissier (finance)", () => {
    const allowed = new Set(["administrateur", "caissier"]);
    for (const cap of PRIVILEGED) {
      const holders = roles.filter((r) => (ROLE_CAPABILITIES[r as keyof typeof ROLE_CAPABILITIES] as readonly string[]).includes(cap));
      for (const h of holders) expect(allowed.has(h), `${cap} held by unexpected role ${h}`).toBe(true);
    }
  });

  it("live external calls are OFF by default (integration + MPI flags fail closed)", () => {
    expect(isLiveIntegrationEnabled({})).toBe(false);
    expect(isMpiLiveEnabled({})).toBe(false);
    expect(isLiveIntegrationEnabled({ HMIS_INTEGRATION_LIVE_ENABLED: "1" })).toBe(false); // only "true" enables
    expect(isMpiLiveEnabled({ HMIS_MPI_LIVE_ENABLED: "yes" })).toBe(false);
  });
});
