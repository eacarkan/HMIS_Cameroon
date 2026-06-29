import { describe, expect, it } from "vitest";

import {
  classifyDuplicates,
  matchesNameDob,
  matchesPhone,
  normalizeName,
  normalizePhone,
  type DuplicateComparable,
} from "@/lib/patient-matching";

const base = {
  familyName: "BELLO",
  givenName: "Aïssatou",
  dateOfBirth: new Date("1990-03-14"),
  phone: "+237 6 99 00 00 01",
};

function patient(over: Partial<DuplicateComparable> & { id: string }): DuplicateComparable {
  return {
    familyName: "BELLO",
    givenName: "Aïssatou",
    dateOfBirth: new Date("1990-03-14"),
    phone: "+237 6 99 00 00 01",
    ...over,
  };
}

describe("unit: patient-matching normalizers", () => {
  it("normalizeName lowercases, strips diacritics, collapses spaces", () => {
    expect(normalizeName("  Aïssatou  ")).toBe("aissatou");
    expect(normalizeName("BELLO")).toBe("bello");
    expect(normalizeName("Jean  Paul")).toBe("jean paul");
  });

  it("normalizePhone keeps digits only", () => {
    expect(normalizePhone("+237 6 99 00 00 01")).toBe("237699000001");
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("unit: duplicate-match thresholds (conservative)", () => {
  it("name+DOB matches across case/diacritic/spacing differences", () => {
    expect(matchesNameDob(base, patient({ id: "x", familyName: "bello", givenName: "Aissatou" }))).toBe(true);
  });

  it("name+DOB does NOT match when DOB differs (no false positive)", () => {
    expect(
      matchesNameDob(base, patient({ id: "x", dateOfBirth: new Date("1991-03-14") })),
    ).toBe(false);
  });

  it("name+DOB does NOT match when a name differs", () => {
    expect(matchesNameDob(base, patient({ id: "x", familyName: "MBARGA" }))).toBe(false);
  });

  it("phone matches on digits regardless of formatting", () => {
    expect(matchesPhone(base, patient({ id: "x", phone: "237699000001" }))).toBe(true);
  });

  it("phone never matches when input phone is empty", () => {
    expect(matchesPhone({ ...base, phone: null }, patient({ id: "x" }))).toBe(false);
    expect(matchesPhone({ ...base, phone: "" }, patient({ id: "x" }))).toBe(false);
  });
});

describe("unit: classifyDuplicates", () => {
  it("flags name_dob with priority over phone, dedupes per patient", () => {
    const matches = classifyDuplicates(base, [patient({ id: "p1" })]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ basis: "name_dob" });
    expect(matches[0].patient.id).toBe("p1");
  });

  it("flags phone-only when name/DOB differ", () => {
    const matches = classifyDuplicates(base, [
      patient({ id: "p2", familyName: "AUTRE", givenName: "Autre", dateOfBirth: new Date("1970-01-01") }),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].basis).toBe("phone");
  });

  it("returns nothing for clearly different patients", () => {
    const matches = classifyDuplicates(base, [
      patient({ id: "p3", familyName: "AUTRE", givenName: "Autre", dateOfBirth: new Date("1970-01-01"), phone: "+237 6 00 00 00 00" }),
    ]);
    expect(matches).toHaveLength(0);
  });
});
