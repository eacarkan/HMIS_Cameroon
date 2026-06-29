import { describe, expect, it } from "vitest";

import {
  MAX_ESTIMATED_AGE,
  approxBirthYear,
  estimatedBirthDate,
  temporaryIdDayPrefix,
  temporaryIdentifierFor,
  validateAgeInput,
} from "@/lib/patient-identity";

describe("unit: patient-identity (Phase 2B)", () => {
  it("derives an approximate birth year + Jan-1 estimated DOB", () => {
    expect(approxBirthYear(30, 2026)).toBe(1996);
    const d = estimatedBirthDate(30, 2026);
    expect(d.getUTCFullYear()).toBe(1996);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it("formats the temporary identifier as Inconnu_YYMMDD_NN", () => {
    const date = new Date(Date.UTC(2026, 5, 29)); // 2026-06-29
    expect(temporaryIdDayPrefix(date)).toBe("Inconnu_260629_");
    expect(temporaryIdentifierFor(date, 1)).toBe("Inconnu_260629_01");
    expect(temporaryIdentifierFor(date, 12)).toBe("Inconnu_260629_12");
  });

  it("validateAgeInput requires EXACTLY ONE of DOB / estimated age", () => {
    expect(validateAgeInput({ dateOfBirth: "1990-01-01" }).ok).toBe(true);
    expect(validateAgeInput({ estimatedAge: 30 }).ok).toBe(true);
    expect(validateAgeInput({ dateOfBirth: "1990-01-01", estimatedAge: 30 }).ok).toBe(false);
    expect(validateAgeInput({}).ok).toBe(false);
    expect(validateAgeInput({ dateOfBirth: "", estimatedAge: null }).ok).toBe(false);
  });

  it("validateAgeInput enforces a sane estimated-age range", () => {
    expect(validateAgeInput({ estimatedAge: 0 }).ok).toBe(true);
    expect(validateAgeInput({ estimatedAge: -1 }).ok).toBe(false);
    expect(validateAgeInput({ estimatedAge: 1.5 }).ok).toBe(false);
    expect(validateAgeInput({ estimatedAge: MAX_ESTIMATED_AGE + 1 }).ok).toBe(false);
  });
});
