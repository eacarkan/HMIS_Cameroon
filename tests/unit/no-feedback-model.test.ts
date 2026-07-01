import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Phase 6F — the first deployment uses EMAIL-BASED feedback only. This guards the
 * boundary: no `FeedbackEntry` (or any feedback) Prisma model may be introduced without
 * explicit operator approval.
 */
describe("unit: Phase 6F — no feedback DB model", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  it("prisma/schema.prisma defines no FeedbackEntry / feedback model", () => {
    expect(schema).not.toMatch(/model\s+FeedbackEntry\b/);
    expect(schema).not.toMatch(/model\s+Feedback\b/i);
  });
});
