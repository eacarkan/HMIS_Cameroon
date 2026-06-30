import { describe, expect, it } from "vitest";

import {
  MAX_ESTIMATED_AGE,
  approxBirthYear,
  estimatedBirthDate,
  nextTemporarySeq,
  parseStrictDob,
  parseTemporarySeq,
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

  it("validateAgeInput hardens a provided DOB (Phase 2 QA): parse / future / >130y", () => {
    const now = new Date("2026-06-29T00:00:00Z");
    expect(validateAgeInput({ dateOfBirth: "not-a-date" }, now).ok).toBe(false);
    expect(validateAgeInput({ dateOfBirth: "2030-01-01" }, now).ok).toBe(false); // future
    expect(validateAgeInput({ dateOfBirth: "1880-01-01" }, now).ok).toBe(false); // >130y
    expect(validateAgeInput({ dateOfBirth: "1990-05-05" }, now).ok).toBe(true); // valid
    expect(validateAgeInput({ estimatedAge: 30 }, now).ok).toBe(true); // estimated path intact
  });

  it("Phase 3F-5 — parseStrictDob accepts only real YYYY-MM-DD dates", () => {
    expect(parseStrictDob("1990-05-05")?.toISOString()).toBe("1990-05-05T00:00:00.000Z");
    // Wrong format → null.
    for (const bad of ["1990", "1990-5-5", "05/05/1990", "1990/05/05", "May 5 1990", "1990-05-05T00:00:00Z", ""]) {
      expect(parseStrictDob(bad), bad).toBeNull();
    }
    // Impossible calendar dates → null (no silent normalisation).
    for (const bad of ["2020-02-30", "2020-13-01", "2021-00-10", "2021-04-31"]) {
      expect(parseStrictDob(bad), bad).toBeNull();
    }
  });

  it("Phase 3F-5 — validateAgeInput rejects non-YYYY-MM-DD and impossible dates", () => {
    const now = new Date("2026-06-29T00:00:00Z");
    for (const bad of ["01/02/1990", "1990", "1990-5-5", "2020-02-30", "2020-13-01"]) {
      expect(validateAgeInput({ dateOfBirth: bad }, now).ok, bad).toBe(false);
    }
    // A real, in-range date still passes.
    expect(validateAgeInput({ dateOfBirth: "2000-12-31" }, now).ok).toBe(true);
  });

  it("Phase 3F-5 — a newborn's DOB = today is accepted just after local midnight (UTC+ tz)", () => {
    // 00:30 WAT (UTC+1) on 2026-06-30 is 2026-06-29T23:30Z. A DOB of today (2026-06-30) must NOT be
    // rejected as "future" (the bug an instant comparison would cause).
    const earlyMorningWat = new Date("2026-06-29T23:30:00Z");
    expect(validateAgeInput({ dateOfBirth: "2026-06-30" }, earlyMorningWat).ok).toBe(true);
    // A clearly future date (beyond the one-day timezone grace) is still rejected.
    expect(validateAgeInput({ dateOfBirth: "2026-07-02" }, earlyMorningWat).ok).toBe(false);
  });

  it("Phase 3F-5 — temporary sequencing is MAX(suffix)+1 (gap-tolerant), suffix parsing is strict", () => {
    const prefix = "Inconnu_260630_";
    expect(parseTemporarySeq("Inconnu_260630_07", prefix)).toBe(7);
    expect(parseTemporarySeq("Inconnu_260630_", prefix)).toBeNull();
    expect(parseTemporarySeq("Inconnu_260631_01", prefix)).toBeNull(); // different day
    expect(nextTemporarySeq([], prefix)).toBe(1);
    expect(nextTemporarySeq(["Inconnu_260630_01", "Inconnu_260630_02"], prefix)).toBe(3);
    // A gap below the max (e.g. _01 removed) must NOT reproduce a taken number — max+1, not count+1.
    expect(nextTemporarySeq(["Inconnu_260630_03"], prefix)).toBe(4);
    expect(nextTemporarySeq(["Inconnu_260630_01", "Inconnu_260631_09"], prefix)).toBe(2); // ignores other days
  });
});
