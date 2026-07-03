import { describe, expect, it } from "vitest";

import {
  isPlaceholderHint,
  resolvePublicDemoPasswordHint,
} from "@/lib/public-demo-hint";

/**
 * Phase 6.3 S3 — the public demo password hint must never render an unset / blank /
 * template-placeholder value (e.g. the deployed `<optional-public-demo-password-or-hint>`).
 */
describe("public demo password hint (Phase 6.3 S3)", () => {
  const FALLBACK = "Password shared separately with authorized reviewers.";

  it("treats unset / blank / angle-bracket / placeholder tokens as unusable", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "   ",
      "<optional-public-demo-password-or-hint>",
      "<your-hint>",
      "TBD",
      "placeholder value",
    ]) {
      expect(isPlaceholderHint(bad), `should reject ${JSON.stringify(bad)}`).toBe(true);
      expect(resolvePublicDemoPasswordHint(bad, FALLBACK)).toBe(FALLBACK);
    }
  });

  it("keeps a real operator-provided hint", () => {
    for (const ok of [
      "Demo2026!",
      "fourni par l'opérateur",
      "(fourni par l'opérateur — voir le runbook)",
      "Ask the SantéGrid team",
    ]) {
      expect(isPlaceholderHint(ok)).toBe(false);
      expect(resolvePublicDemoPasswordHint(ok, FALLBACK)).toBe(ok.trim());
    }
  });
});
