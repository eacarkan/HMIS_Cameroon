import { describe, expect, it } from "vitest";

import {
  assertAggregateOnly,
  classifyExportRows,
  matchesLocalElement,
  validateMappingInput,
  validateMappingSetInput,
} from "@/lib/dhis2-mapping";

/**
 * Phase 4B — pure DHIS2 mapping helpers. Validates the mapping-set/mapping inputs, the exact +
 * wildcard element matching, the mapped/unmapped classification (validation before export), and the
 * aggregate-only guard that keeps any nominative field out of an export payload.
 */
describe("unit: Phase 4B DHIS2 mapping helpers", () => {
  it("validateMappingSetInput requires an UPPER code + name", () => {
    expect(validateMappingSetInput({ code: "DHIS2_DEFAUT", name: "Défaut" }).ok).toBe(true);
    expect(validateMappingSetInput({ code: "lower", name: "x" }).ok).toBe(false);
    expect(validateMappingSetInput({ code: "OK", name: "" }).ok).toBe(false);
  });

  it("validateMappingInput requires a local element + a data-element placeholder", () => {
    expect(validateMappingInput({ localElement: "CONSULTATIONS", dataElementPlaceholder: "DE_UID" }).ok).toBe(true);
    expect(validateMappingInput({ localElement: "", dataElementPlaceholder: "DE_UID" }).ok).toBe(false);
    expect(validateMappingInput({ localElement: "X", dataElementPlaceholder: "" }).ok).toBe(false);
  });

  it("matchesLocalElement supports exact and PREFIX:* wildcard", () => {
    expect(matchesLocalElement("CONSULTATIONS", "CONSULTATIONS")).toBe(true);
    expect(matchesLocalElement("DIAG:*", "DIAG:B50")).toBe(true);
    expect(matchesLocalElement("DIAG:*", "CONSULTATIONS")).toBe(false);
    expect(matchesLocalElement("DIAG:B50", "DIAG:B51")).toBe(false);
  });

  it("classifyExportRows reports mapped vs unmapped (validation before export)", () => {
    const rows = [{ dataElement: "CONSULTATIONS" }, { dataElement: "DIAG:B50" }, { dataElement: "DIAG:J06" }];
    const none = classifyExportRows(rows, []);
    expect(none.ready).toBe(false);
    expect(none.unmapped).toEqual(["CONSULTATIONS", "DIAG:B50", "DIAG:J06"]);
    const full = classifyExportRows(rows, [{ localElement: "CONSULTATIONS" }, { localElement: "DIAG:*" }]);
    expect(full.ready).toBe(true);
    expect(full.unmapped).toEqual([]);
  });

  it("assertAggregateOnly rejects any non-aggregate field", () => {
    expect(assertAggregateOnly([{ period: "2026-06", orgUnit: "HRB", dataElement: "CONSULTATIONS", ageBand: "a", gender: "M", value: 3 }]).ok).toBe(true);
    const leak = assertAggregateOnly([{ period: "2026-06", orgUnit: "HRB", dataElement: "X", ageBand: "a", gender: "M", value: 1, familyName: "SECRET" }]);
    expect(leak.ok).toBe(false);
  });
});
