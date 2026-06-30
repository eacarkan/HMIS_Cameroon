/**
 * DHIS2-aligned aggregate reporting (pure, client-safe) — Phase 2E.
 *
 * Age/gender banding + the manual-upload CSV builder. Everything here is AGGREGATE ONLY: the CSV row
 * type carries period / org-unit / data-element / age-band / gender / integer value — there is no field
 * that could hold a patient name, id, DOB, phone or any nominative data. Age bands are derived from
 * demographics in the aggregation layer and only the band COUNT is emitted, never the demographic value.
 * No data access. DHIS2 direct API is deferred (Phase 4) — this is a manual CSV only.
 */

import { ageInYears } from "./dates";

/** Standard epidemiological age bands (years). Closed lower bound; `max` null = open-ended. */
export const AGE_BANDS = [
  { key: "<1", min: 0, max: 0 },
  { key: "1-4", min: 1, max: 4 },
  { key: "5-14", min: 5, max: 14 },
  { key: "15-24", min: 15, max: 24 },
  { key: "25-34", min: 25, max: 34 },
  { key: "35-49", min: 35, max: 49 },
  { key: "50-64", min: 50, max: 64 },
  { key: "65+", min: 65, max: null as number | null },
] as const;

export type AgeBandKey = (typeof AGE_BANDS)[number]["key"];

/** Map an age in whole years to its band key (negative/NaN ages fall in the first band defensively). */
export function ageBand(ageYears: number): AgeBandKey {
  const a = Number.isFinite(ageYears) ? Math.max(0, Math.trunc(ageYears)) : 0;
  for (const b of AGE_BANDS) {
    if (a >= b.min && (b.max === null || a <= b.max)) return b.key;
  }
  return "65+";
}

/** Standard gender code for DHIS2 disaggregation. */
export function genderCode(sex: string): "M" | "F" | "U" {
  if (sex === "male") return "M";
  if (sex === "female") return "F";
  return "U";
}

/**
 * A patient's age in whole years for banding: an estimated age is used as-is; otherwise it is derived
 * from the date of birth. Only the resulting band is ever emitted — never the DOB itself.
 */
export function patientAgeYears(
  patient: { dateOfBirth: Date | string; estimatedAge?: number | null; isEstimatedAge?: boolean | null },
  asOf: Date,
): number {
  if (patient.isEstimatedAge && patient.estimatedAge != null) return Math.max(0, Math.trunc(patient.estimatedAge));
  return ageInYears(new Date(patient.dateOfBirth), asOf);
}

/** A single aggregate DHIS2 row — strictly non-nominative by construction. */
export type Dhis2Row = {
  period: string; // e.g. "2026-06"
  orgUnit: string; // the hospital code — NOT a patient
  dataElement: string; // e.g. "CONSULTATIONS" or "DIAG:B50"
  ageBand: AgeBandKey;
  gender: "M" | "F" | "U";
  value: number; // integer count
};

export const DHIS2_CSV_HEADER = ["period", "orgUnit", "dataElement", "ageBand", "gender", "value"] as const;

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Build the DHIS2-aligned CSV from aggregate rows (UTF-8 BOM + CRLF so spreadsheets render accents and
 * DHIS2 imports cleanly). Rows with a zero/negative value are dropped. Deterministic ordering.
 */
export function buildDhis2Csv(rows: Dhis2Row[]): { csv: string; rowCount: number } {
  const kept = rows.filter((r) => Math.trunc(r.value) > 0);
  const sorted = [...kept].sort(
    (a, b) =>
      a.dataElement.localeCompare(b.dataElement) ||
      a.ageBand.localeCompare(b.ageBand) ||
      a.gender.localeCompare(b.gender),
  );
  const lines = [DHIS2_CSV_HEADER.join(",")];
  for (const r of sorted) {
    lines.push(
      [r.period, r.orgUnit, r.dataElement, r.ageBand, r.gender, Math.trunc(r.value)]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  return { csv, rowCount: sorted.length };
}
