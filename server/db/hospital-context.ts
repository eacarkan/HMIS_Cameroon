/**
 * Hospital context — the cornerstone of hospital-scoped data access (D-011, 09 §5).
 *
 * Every operational record is reachable ONLY within its hospital. The active context
 * is resolved per request from the session + the active-hospital cookie (see
 * `server/auth/active-hospital`), validated against the actor's access, and passed
 * into every service and data-access call — never trusted from a raw client parameter.
 *
 * The type itself lives in `lib/hospital-context` (client-safe, for UI props) and is
 * re-exported here so server code imports it from the data-access layer.
 */
export type { HospitalContext } from "@/lib/hospital-context";
