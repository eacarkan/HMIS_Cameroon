/**
 * Hospital context — the cornerstone of hospital-scoped data access (D-011, 09 §5).
 *
 * Every operational record (Patient, Encounter, Consultation, Invoice, Payment,
 * AuditLog, Sequence, per-hospital settings) is reachable ONLY within its hospital.
 * The active hospital is established server-side and passed into every service and
 * data-access call — never trusted from a raw client parameter alone.
 *
 * FOUNDATIONS (Steps 1-2): this is a PLACEHOLDER. The real selector + session-derived
 * context arrive at Step 5. No real selection and no DB lookup happen here yet; the
 * type and helpers exist so the data-access boundary already has the right shape.
 */
import { DEMO_HOSPITAL } from "@/lib/constants";

export type HospitalContext = {
  /** Internal hospital id (DB primary key once the schema lands at Step 3+). */
  hospitalId: string;
  /** Stable hospital code, e.g. "HRB-DEMO". */
  code: string;
  /** Display name, e.g. "Hôpital Régional de Bertoua — Démo". */
  name: string;
  /** Region label, e.g. "Est". */
  region: string;
};

/**
 * Display-only placeholder for the top bar's hospital-context slot.
 * Mirrors the demo hospital from 07_Demo_Scenario (HRB-DEMO) but is NOT a real,
 * selected context — it never authorizes data access.
 */
export const PLACEHOLDER_HOSPITAL_CONTEXT: HospitalContext = {
  hospitalId: "placeholder",
  code: DEMO_HOSPITAL.code,
  name: DEMO_HOSPITAL.name,
  region: DEMO_HOSPITAL.region,
};

/**
 * Resolve the active hospital context for the current request.
 *
 * Real implementation (Step 5): derive from the authenticated session + the
 * active-hospital selection, and reject any access without one (09 §5: "A query
 * without a hospital context is a defect."). Until then it fails loudly so no
 * data-access path can silently run unscoped.
 */
export function requireHospitalContext(): HospitalContext {
  throw new Error(
    "Hospital context is not wired yet (arrives at build Step 5). " +
      "Every data-access function must receive a HospitalContext before any query runs.",
  );
}
