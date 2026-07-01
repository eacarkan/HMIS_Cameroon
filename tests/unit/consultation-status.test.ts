import { describe, expect, it } from "vitest";

import {
  canAmend,
  canFinalize,
  isConsultationStatus,
} from "@/lib/consultation-status";

describe("unit: consultation finalize/amend rules", () => {
  it("a draft can be finalized but not amended", () => {
    expect(canFinalize("draft")).toBe(true);
    expect(canAmend("draft")).toBe(false);
  });

  it("a finalized note can be amended but not re-finalized", () => {
    expect(canFinalize("finalized")).toBe(false);
    expect(canAmend("finalized")).toBe(true);
  });

  it("guards unknown statuses", () => {
    expect(isConsultationStatus("draft")).toBe(true);
    expect(isConsultationStatus("finalized")).toBe(true);
    expect(isConsultationStatus("signed")).toBe(false);
  });
});
