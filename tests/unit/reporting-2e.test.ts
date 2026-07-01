import { describe, expect, it } from "vitest";

import {
  AGE_BANDS,
  ageBand,
  buildDhis2Csv,
  DHIS2_CSV_HEADER,
  genderCode,
  patientAgeYears,
  type Dhis2Row,
} from "@/lib/dhis2";
import { monthLabel, monthPeriod, parseMonthParam, topDiagnoses } from "@/lib/reporting";

const asOf = new Date("2026-06-30");

describe("DHIS2 banding (Phase 2E)", () => {
  it("maps ages to the standard bands", () => {
    expect(ageBand(0)).toBe("<1");
    expect(ageBand(3)).toBe("1-4");
    expect(ageBand(10)).toBe("5-14");
    expect(ageBand(20)).toBe("15-24");
    expect(ageBand(30)).toBe("25-34");
    expect(ageBand(40)).toBe("35-49");
    expect(ageBand(60)).toBe("50-64");
    expect(ageBand(80)).toBe("65+");
    expect(ageBand(-5)).toBe("<1"); // defensive
  });

  it("codes gender", () => {
    expect(genderCode("male")).toBe("M");
    expect(genderCode("female")).toBe("F");
    expect(genderCode("other")).toBe("U");
  });

  it("derives age from estimated age or DOB", () => {
    expect(patientAgeYears({ dateOfBirth: "1990-01-01" }, asOf)).toBe(36);
    expect(patientAgeYears({ dateOfBirth: "2000-01-01", estimatedAge: 5, isEstimatedAge: true }, asOf)).toBe(5);
  });

  it("AGE_BANDS covers contiguous ranges up to open-ended 65+", () => {
    expect(AGE_BANDS[0].key).toBe("<1");
    expect(AGE_BANDS[AGE_BANDS.length - 1].max).toBeNull();
  });
});

describe("DHIS2 CSV (Phase 2E) — aggregate only, no nominative fields", () => {
  const rows: Dhis2Row[] = [
    { period: "2026-06", orgUnit: "HRB-DEMO", dataElement: "CONSULTATIONS", ageBand: "25-34", gender: "F", value: 3 },
    { period: "2026-06", orgUnit: "HRB-DEMO", dataElement: "CONSULTATIONS", ageBand: "25-34", gender: "M", value: 0 }, // dropped
    { period: "2026-06", orgUnit: "HRB-DEMO", dataElement: "DIAG:B50", ageBand: "1-4", gender: "M", value: 2 },
  ];

  it("the header is strictly the aggregate columns — no patient field exists", () => {
    expect([...DHIS2_CSV_HEADER]).toEqual(["period", "orgUnit", "dataElement", "ageBand", "gender", "value"]);
    expect(DHIS2_CSV_HEADER).not.toContain("name");
    expect(DHIS2_CSV_HEADER).not.toContain("patient");
  });

  it("builds a BOM CSV, drops zero rows, counts kept rows", () => {
    const { csv, rowCount } = buildDhis2Csv(rows);
    expect(rowCount).toBe(2); // the value=0 row is dropped
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("DIAG:B50,1-4,M,2");
    expect(csv).toContain("CONSULTATIONS,25-34,F,3");
    // No nominative content can appear — the row type has no such field.
    expect(csv).not.toMatch(/MENGUE|DUPONT|patient/i);
  });
});

describe("reporting period helpers (Phase 2E)", () => {
  it("computes a calendar-month period + label", () => {
    const p = monthPeriod(2026, 6);
    expect(p.label).toBe("2026-06");
    expect(p.start.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(p.endExclusive.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("parses and validates a YYYY-MM month param", () => {
    expect(parseMonthParam("2026-06")).toEqual({ year: 2026, month: 6 });
    expect(parseMonthParam("2026-13")).toBeNull();
    expect(parseMonthParam("nope")).toBeNull();
    expect(parseMonthParam(null)).toBeNull();
  });

  it("monthLabel formats a date", () => {
    expect(monthLabel(new Date("2026-06-15T00:00:00Z"))).toBe("2026-06");
  });

  it("ranks the top diagnoses by count", () => {
    const top = topDiagnoses(
      [
        { code: "B50", label: "Paludisme" },
        { code: "B50", label: "Paludisme" },
        { code: "J06", label: "IVRS" },
        { code: null, label: "Sans code" },
      ],
      10,
    );
    expect(top[0]).toMatchObject({ code: "B50", count: 2 });
    expect(top.find((d) => d.code === "(sans code)")?.count).toBe(1);
  });
});
