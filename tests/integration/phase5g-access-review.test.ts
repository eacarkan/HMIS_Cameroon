import { describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import {
  getAnalyticsAdmin,
  getCentralOversight,
  getInsuranceAdmin,
  getPatientMatchReview,
} from "@/server/services";
import { ACCOUNTS, actorFor, loginAndSelect } from "../helpers/actors";

/**
 * Phase 5G — consolidated app-level access review (DB-backed). One place that proves the cross-phase
 * authorization posture: clinical roles cannot reach admin/finance/integration/analytics/patient-match
 * surfaces; the central supervisor sees ONLY aggregate oversight (never patient-level); and the only
 * cross-hospital capability is central aggregate view. Server-side RBAC is authoritative. Synthetic only.
 */
const HRB = "hosp-hrb-demo";
const CENTRAL = "direction.regionale@hrb-demo.cm";

describe("integration: Phase 5G access review (server-side RBAC authoritative)", () => {
  it("a clinical doctor is DENIED every non-clinical admin/finance surface", async () => {
    const doctor = await loginAndSelect(ACCOUNTS.doctor);
    await expect(getInsuranceAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);   // 4E
    await expect(getAnalyticsAdmin(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError);   // 4F
    await expect(getPatientMatchReview(doctor.actor, doctor.ctx)).rejects.toBeInstanceOf(AuthorizationError); // 4G
    await expect(getCentralOversight(doctor.actor)).rejects.toBeInstanceOf(AuthorizationError);             // 3D/3B
  });

  it("the central supervisor sees ONLY aggregate oversight — never patient-level or financial surfaces", async () => {
    const central = await actorFor(CENTRAL);
    // Aggregate oversight is allowed (aggregate-only, snapshot-fed).
    await expect(getCentralOversight(central)).resolves.toBeTruthy();
    // Patient-level (4G) and finance/insurance (4E) surfaces at a hospital are denied.
    const ctx = { hospitalId: HRB, code: "HRB-DEMO", name: "HRB", region: "Est" };
    await expect(getPatientMatchReview(central, ctx)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(getInsuranceAdmin(central, ctx)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("the hospital admin has NO cross-hospital reach — central oversight is denied", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin); // administrateur lacks central.aggregate.view
    await expect(getCentralOversight(admin.actor)).rejects.toBeInstanceOf(AuthorizationError);
  });
});
