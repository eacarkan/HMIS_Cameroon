import { describe, expect, it } from "vitest";

import { RELEASE_CANDIDATE, RELEASE_LABEL, PROTOTYPE_LABEL } from "@/lib/constants";

/**
 * Phase 5F — release-candidate marker. Locks the version to a SYNTHETIC release candidate and forbids
 * any production / Gate-7 claim slipping into the marker.
 */
describe("unit: Phase 5F release-candidate marker", () => {
  it("is a release-candidate version (vX.Y.Z-rc.N)", () => {
    expect(RELEASE_CANDIDATE).toMatch(/^v\d+\.\d+\.\d+-rc\.\d+$/);
  });

  it("labels the build synthetic + non-production, with no Gate-7 authorization claim", () => {
    expect(RELEASE_LABEL).toMatch(/synth[ée]tiques/i);
    expect(RELEASE_LABEL).toMatch(/non production/i);
    expect(RELEASE_LABEL).toMatch(/hors Gate 7/i);
    // Never an authorized-production claim.
    expect(RELEASE_LABEL.toLowerCase()).not.toMatch(/prêt pour la production|production ready|autoris/);
    expect(PROTOTYPE_LABEL).toMatch(/non destiné à la production/i);
  });
});
