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

  it("labels the build a synthetic review environment, with no production / Gate-7 claim", () => {
    // Phase 6.3 S3 (mentor-approved wording): review-environment + synthetic + outside-Gate-7.
    expect(RELEASE_LABEL).toMatch(/environnement de revue/i);
    expect(RELEASE_LABEL).toMatch(/synth[ée]tiques/i);
    expect(RELEASE_LABEL).toMatch(/hors Gate 7/i);
    // Never a production claim (the word "production" must not appear at all).
    expect(RELEASE_LABEL.toLowerCase()).not.toMatch(/production|autoris/);
    // The formal archival marker (sr-only banner + print docs) still carries the full wording.
    expect(PROTOTYPE_LABEL).toMatch(/non destiné à la production/i);
  });
});
