/**
 * Phase 4B — pure helpers for the DHIS2 mapping framework (no I/O, no server imports). Validate the
 * mapping set + mappings, classify aggregate export rows against a mapping (mapped vs unmapped —
 * validation BEFORE export), and re-assert that export rows carry ONLY aggregate fields (no patient
 * identifiers). Placeholders are non-secret and non-final; real Ministry codes are configured later.
 */

import { DHIS2_CSV_HEADER } from "./dhis2";

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result = Ok | Err;

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

export function validateMappingSetInput(input: { code: string; name: string }): Result {
  if (!CODE_RE.test(input.code?.trim() ?? "")) {
    return { ok: false, error: "Le code du jeu de correspondances doit être en MAJUSCULES (2 à 40 caractères)." };
  }
  if (!input.name?.trim()) return { ok: false, error: "Le nom du jeu de correspondances est obligatoire." };
  return { ok: true };
}

export function validateMappingInput(input: { localElement: string; dataElementPlaceholder: string }): Result {
  if (!input.localElement?.trim()) return { ok: false, error: "L'élément local est obligatoire." };
  if (!input.dataElementPlaceholder?.trim()) {
    return { ok: false, error: "Le placeholder de l'élément de données DHIS2 est obligatoire." };
  }
  return { ok: true };
}

/** Does a mapping's `localElement` match a row's data element? Supports an exact match or a "PREFIX:*" wildcard. */
export function matchesLocalElement(mappingLocal: string, rowElement: string): boolean {
  const m = mappingLocal.trim();
  if (m === rowElement) return true;
  if (m.endsWith(":*")) return rowElement.startsWith(m.slice(0, -1)); // "DIAG:*" matches "DIAG:B50"
  return false;
}

/**
 * Classify the DISTINCT data elements present in the aggregate rows against the mapping set: which are
 * MAPPED and which are UNMAPPED. An export is "ready" only when nothing is unmapped — the caller uses
 * this to VALIDATE BEFORE EXPORT (no half-mapped export is produced).
 */
export function classifyExportRows(
  rows: { dataElement: string }[],
  mappings: { localElement: string }[],
): { mapped: string[]; unmapped: string[]; ready: boolean } {
  const distinct = Array.from(new Set(rows.map((r) => r.dataElement))).sort();
  const mapped: string[] = [];
  const unmapped: string[] = [];
  for (const el of distinct) {
    if (mappings.some((m) => matchesLocalElement(m.localElement, el))) mapped.push(el);
    else unmapped.push(el);
  }
  return { mapped, unmapped, ready: unmapped.length === 0 };
}

/** The ONLY keys an aggregate DHIS2 export row may carry (matches the CSV header). No nominative field. */
const ALLOWED_ROW_KEYS = new Set<string>(DHIS2_CSV_HEADER);

/**
 * Re-assert an export payload is aggregate-only: every row must carry ONLY the allowed aggregate keys
 * (period / orgUnit / dataElement / ageBand / gender / value) — never a name / number / DOB / diagnosis
 * free text. Belt-and-suspenders privacy guard before any DHIS2 export leaves the service.
 */
export function assertAggregateOnly(rows: Record<string, unknown>[]): Result {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!ALLOWED_ROW_KEYS.has(key)) {
        return { ok: false, error: `Champ non agrégé « ${key} » interdit dans un export DHIS2.` };
      }
    }
  }
  return { ok: true };
}
