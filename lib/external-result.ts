/**
 * Phase 4C — pure helpers for the external lab/radiology result import framework (no I/O, no server
 * imports). A row parser for the manual CSV/structured import, an ADAPTER interface for a future
 * HL7/LIS/analyzer/PACS source (mock only — no live connection), and the review guard. Imported data
 * is always STAGING — nothing here writes a clinical result.
 */

export type ExternalResultStatusCode = "NEEDS_REVIEW" | "PROMOTED" | "REJECTED" | "DUPLICATE";
export const EXTERNAL_RESULT_STATUSES: readonly ExternalResultStatusCode[] = [
  "NEEDS_REVIEW",
  "PROMOTED",
  "REJECTED",
  "DUPLICATE",
];

/** One imported result row (before staging). All fields are references/text — never a clinical write. */
export type ExternalResultRow = {
  externalRef: string;
  patientRef: string;
  orderRef: string | null;
  modality: string;
  testCode: string;
  resultText: string;
};

/** The adapter interface a future HL7 / LIS / analyzer / PACS source would implement. Mock/CSV only now. */
export interface ExternalResultAdapter {
  readonly source: string;
  readonly isMock: boolean;
  fetchRows(): Promise<ExternalResultRow[]>;
}

const REQUIRED = ["externalRef", "patientRef", "modality", "testCode", "resultText"] as const;
export const IMPORT_CSV_HEADER = ["externalRef", "patientRef", "orderRef", "modality", "testCode", "resultText"] as const;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/**
 * Parse the manual import CSV (header + rows). Returns valid rows + per-line errors. Deterministic;
 * tolerant of a UTF-8 BOM, CRLF, and quoted fields. Header must contain the required columns.
 */
export function parseImportCsv(text: string): { rows: ExternalResultRow[]; errors: string[] } {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { rows: [], errors: ["Fichier vide."] };
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  for (const col of REQUIRED) {
    if (idx(col) === -1) errors.push(`Colonne obligatoire manquante : ${col}.`);
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ExternalResultRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (name: string) => (idx(name) >= 0 ? (cells[idx(name)] ?? "").trim() : "");
    const row: ExternalResultRow = {
      externalRef: get("externalRef"),
      patientRef: get("patientRef"),
      orderRef: get("orderRef") || null,
      modality: get("modality"),
      testCode: get("testCode"),
      resultText: get("resultText"),
    };
    const missing = REQUIRED.filter((c) => !row[c]);
    if (missing.length > 0) {
      errors.push(`Ligne ${i + 1} ignorée — champs manquants : ${missing.join(", ")}.`);
      continue;
    }
    rows.push(row);
  }
  return { rows, errors };
}

/** Only a NEEDS_REVIEW staging record may be reviewed (promoted/rejected). */
export function canReviewImport(status: ExternalResultStatusCode): boolean {
  return status === "NEEDS_REVIEW";
}
