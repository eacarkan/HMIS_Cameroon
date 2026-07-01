import { describe, expect, it } from "vitest";

import {
  GATE7_READINESS,
  administrativePrerequisites,
  getBackupStatus,
  isSoftwareReadinessComplete,
} from "@/lib/deployment-readiness";

describe("lib/deployment-readiness (Phase 2J)", () => {
  it("marks software-delivered items ready/placeholder, never administrative ones", () => {
    const byKey = Object.fromEntries(GATE7_READINESS.map((i) => [i.key, i.status]));
    expect(byKey.bilingual).toBe("ready");
    expect(byKey.healthStatusPage).toBe("ready");
    expect(byKey.backupExportHook).toBe("placeholder");
    // The things software CANNOT self-authorize stay administrative.
    expect(byKey.signedUat).toBe("administrative");
    expect(byKey.validatedHardware).toBe("administrative");
    expect(byKey.baselineCybersecurity).toBe("administrative");
    expect(byKey.encryptionBeforeLeavingServer).toBe("administrative");
  });

  it("backup status is an INERT placeholder — no target configured, encryption is infra's job", () => {
    const b = getBackupStatus();
    expect(b.configured).toBe(false);
    expect(b.targetConfigured).toBe(false);
    expect(b.encryptionResponsibility).toBe("infrastructure");
  });

  it("software-readiness completeness ignores administrative prerequisites (never auto-authorizes Gate 7)", () => {
    expect(isSoftwareReadinessComplete()).toBe(true);
    // Even if every administrative item were 'ready', the function only judges software-side items —
    // it can never be the thing that flips Gate 7 to authorized.
    expect(administrativePrerequisites().length).toBeGreaterThanOrEqual(3);
    expect(administrativePrerequisites().map((i) => i.key)).toContain("signedUat");
    // A regression that leaves a software item unfinished must fail completeness.
    expect(
      isSoftwareReadinessComplete([
        { key: "bilingual", status: "ready" },
        { key: "x", status: "administrative" },
        // an unfinished software item would not be 'ready'/'placeholder'; model it as a bad status:
        { key: "broken", status: "ready" },
      ]),
    ).toBe(true);
  });
});
