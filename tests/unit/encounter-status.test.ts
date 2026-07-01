import { describe, expect, it } from "vitest";

import {
  canTransition,
  isEncounterStatus,
  VALID_TRANSITIONS,
} from "@/lib/encounter-status";

describe("unit: encounter status transitions", () => {
  it("allows open → closed and open → cancelled", () => {
    expect(canTransition("open", "closed")).toBe(true);
    expect(canTransition("open", "cancelled")).toBe(true);
  });

  it("rejects leaving terminal states", () => {
    expect(canTransition("closed", "open")).toBe(false);
    expect(canTransition("closed", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "open")).toBe(false);
    expect(canTransition("cancelled", "closed")).toBe(false);
  });

  it("rejects no-op transitions", () => {
    expect(canTransition("open", "open")).toBe(false);
    expect(canTransition("closed", "closed")).toBe(false);
  });

  it("terminal states have no outgoing transitions", () => {
    expect(VALID_TRANSITIONS.closed).toHaveLength(0);
    expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it("isEncounterStatus guards unknown values", () => {
    expect(isEncounterStatus("open")).toBe(true);
    expect(isEncounterStatus("finalisée")).toBe(false);
    expect(isEncounterStatus("inpatient")).toBe(false); // Phase 2 — not a Phase 1 status
  });
});
