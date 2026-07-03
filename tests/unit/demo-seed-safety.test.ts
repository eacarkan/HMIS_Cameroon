import { describe, expect, it } from "vitest";

import {
  SYNTHETIC_CONTACT_PREFIX,
  forceGuardError,
  looksLikeRealPhone,
  syntheticContact,
} from "@/lib/demo-seed-safety";

/**
 * Phase 6.3 S1A — mentor-required safety guards for the synthetic demo seed:
 *  (1) synthetic patient contacts must never look like real phone numbers;
 *  (2) `--force` must be refused unless `--test` is also present.
 */
describe("demo seed safety — synthetic contacts", () => {
  it("produces clearly-artificial contact tokens, not phone numbers", () => {
    expect(syntheticContact(0)).toBe("DEMO-CONTACT-000001");
    expect(syntheticContact(112)).toBe("DEMO-CONTACT-000113");
    for (let i = 0; i < 200; i++) {
      const c = syntheticContact(i);
      expect(c.startsWith(SYNTHETIC_CONTACT_PREFIX)).toBe(true);
      expect(looksLikeRealPhone(c)).toBe(false); // never mistakable for a real phone
    }
  });

  it("flags plausible real Cameroon / international phone patterns", () => {
    for (const real of [
      "+237 6 99 00 00 01",
      "+237 2 22 00 00 00",
      "+237699000001",
      "699000001",
      "222000000",
      "+33 6 12 34 56 78",
      "0612345678",
    ]) {
      expect(looksLikeRealPhone(real), `should flag ${real}`).toBe(true);
    }
  });

  it("does not flag empty / obviously-fake values", () => {
    for (const ok of [null, undefined, "", "DEMO-CONTACT-000001", "SYNTHETIC", "n/a"]) {
      expect(looksLikeRealPhone(ok)).toBe(false);
    }
  });
});

describe("demo seed safety — --force guard", () => {
  it("refuses --force without --test", () => {
    const msg = forceGuardError(true, false);
    expect(msg).toBeTruthy();
    expect(msg).toMatch(/only allowed with --test/i);
  });

  it("allows --force together with --test", () => {
    expect(forceGuardError(true, true)).toBeNull();
  });

  it("allows a plain run and a plain --test run", () => {
    expect(forceGuardError(false, false)).toBeNull();
    expect(forceGuardError(false, true)).toBeNull();
  });
});
