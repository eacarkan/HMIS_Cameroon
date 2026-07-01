/**
 * Hospital context type (client-safe, 09 §5). The value is resolved server-side from
 * the session + active-hospital cookie; this pure type is shared with UI props, so it
 * lives in `lib` (the UI must not import `server/db`). Server code re-exports it via
 * `server/db`.
 */
export type HospitalContext = {
  /** Internal hospital id (DB primary key). */
  hospitalId: string;
  /** Stable hospital code, e.g. "HRB-DEMO". */
  code: string;
  /** Display name, e.g. "Hôpital Régional de Bertoua — Démo". */
  name: string;
  /** Region label, e.g. "Est". */
  region: string;
};
