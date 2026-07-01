/**
 * Data-mode separation (pure, client-safe) — Phase 1A Batch 6.
 *
 * The application runs only on fake/demo (or pilot demo) data. The **real patient-data path
 * is disabled** in Phase 1A and can only be unlocked organizationally at Gate 7 — never by a
 * config value here. `resolveDataMode` fails closed: any unexpected value (including "real")
 * resolves to "demo". No data access.
 */
export type DataMode = "demo" | "pilot";

/** Fail-closed: only "pilot" is honoured; everything else (incl. "real") → "demo". */
export function resolveDataMode(value: string | undefined): DataMode {
  return value === "pilot" ? "pilot" : "demo";
}

/** Whether a "real data" mode was requested (it is ignored — surfaced for diagnostics). */
export function isRealDataRequested(value: string | undefined): boolean {
  return value === "real" || value === "production";
}

/** Real patient-data path — DISABLED in Phase 1A (Gate 7 is organizational, not a flag). */
export const REAL_DATA_ENABLED = false;

export const DATA_MODE: DataMode = resolveDataMode(process.env.HMIS_DATA_MODE);

/** Visible "fake data" marker for the UI. */
export const DATA_MODE_LABEL = "DÉMO / PILOTE — données fictives";

export const APP_VERSION = "0.1.0-phase1a";

/** Guard the real-data path — throws while it is disabled. Belt-and-suspenders. */
export function assertFakeDataOnly(): void {
  if (REAL_DATA_ENABLED) {
    throw new Error(
      "Chemin de données réelles désactivé — autorisation Gate 7 requise.",
    );
  }
}
