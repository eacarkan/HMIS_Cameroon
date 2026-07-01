import { describe, expect, it } from "vitest";

import {
  DRAFT_AUTOSAVE_ALLOWED_KINDS,
  draftKey,
  isDraftAutosaveAllowed,
  shouldPersistDraft,
} from "@/lib/draft-autosave";

describe("lib/draft-autosave — scope guard (Phase 2J)", () => {
  it("allows ONLY long-note kinds", () => {
    expect(DRAFT_AUTOSAVE_ALLOWED_KINDS).toEqual(["consultation-note", "prescription-note"]);
    expect(isDraftAutosaveAllowed("consultation-note")).toBe(true);
    expect(isDraftAutosaveAllowed("prescription-note")).toBe(true);
  });

  it("NEVER allows financial / stock / irreversible kinds", () => {
    for (const forbidden of [
      "payment",
      "invoice",
      "refund",
      "cashier-shift",
      "stock-adjustment",
      "stock-receive",
      "dispense",
      "emergency-debt",
      "admission",
      "diagnostic-order",
      "",
      "anything-else",
    ]) {
      expect(isDraftAutosaveAllowed(forbidden)).toBe(false);
    }
  });

  it("derives a deterministic, scoped key", () => {
    expect(draftKey({ kind: "consultation-note", scopeId: "enc-1" })).toBe("hmis-draft:consultation-note:enc-1");
    expect(draftKey({ kind: "consultation-note", scopeId: "enc-1" })).toBe(
      draftKey({ kind: "consultation-note", scopeId: "enc-1" }),
    );
    expect(draftKey({ kind: "consultation-note", scopeId: "enc-1" })).not.toBe(
      draftKey({ kind: "consultation-note", scopeId: "enc-2" }),
    );
  });

  it("only persists meaningful (non-whitespace) content", () => {
    expect(shouldPersistDraft("Observation clinique")).toBe(true);
    expect(shouldPersistDraft("   ")).toBe(false);
    expect(shouldPersistDraft("")).toBe(false);
  });
});
