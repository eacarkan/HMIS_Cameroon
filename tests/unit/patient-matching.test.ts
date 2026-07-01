import { describe, expect, it } from "vitest";

import {
  classifyDuplicates,
  isDuplicateOverrideConfirmed,
  matchesNameDob,
  matchesPhone,
  normalizeName,
  normalizePhone,
  registrationFingerprint,
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

describe("unit: registrationFingerprint (binds an override to the warned data)", () => {
  const identity = {
    familyName: "BELLO",
    givenName: "Aïssatou",
    dateOfBirth: new Date("1990-03-14"),
    phone: "+237 6 99 00 00 01",
    sex: "female",
  };

  it("is stable across case / diacritics / phone formatting of the same identity", () => {
    expect(registrationFingerprint(identity)).toBe(
      registrationFingerprint({
        ...identity,
        familyName: "  bello ",
        givenName: "aissatou",
        phone: "237699000001",
      }),
    );
  });

  it("changes when ANY identifying field changes", () => {
    const base = registrationFingerprint(identity);
    expect(registrationFingerprint({ ...identity, dateOfBirth: new Date("1991-03-14") })).not.toBe(base);
    expect(registrationFingerprint({ ...identity, familyName: "MBARGA" })).not.toBe(base);
    expect(registrationFingerprint({ ...identity, givenName: "Fatou" })).not.toBe(base);
    expect(registrationFingerprint({ ...identity, phone: "237600000000" })).not.toBe(base);
    expect(registrationFingerprint({ ...identity, sex: "male" })).not.toBe(base);
  });
});

describe("unit: isDuplicateOverrideConfirmed (edited-after-warning is NOT confirmed)", () => {
  const fp = "bello|aissatou|1990-03-14|237699000001|female";

  it("confirms only when intent is set AND the data matches the warned fingerprint", () => {
    expect(
      isDuplicateOverrideConfirmed({ confirmIntent: true, warnedFingerprint: fp, currentFingerprint: fp }),
    ).toBe(true);
  });

  it("does NOT confirm when the user edited the data after the warning (fingerprint mismatch)", () => {
    expect(
      isDuplicateOverrideConfirmed({ confirmIntent: true, warnedFingerprint: fp, currentFingerprint: fp + "X" }),
    ).toBe(false);
  });

  it("does NOT confirm without an explicit confirm intent", () => {
    expect(
      isDuplicateOverrideConfirmed({ confirmIntent: false, warnedFingerprint: fp, currentFingerprint: fp }),
    ).toBe(false);
  });

  it("does NOT confirm on a first submit (no prior warning)", () => {
    expect(
      isDuplicateOverrideConfirmed({ confirmIntent: true, warnedFingerprint: undefined, currentFingerprint: fp }),
    ).toBe(false);
  });
});
