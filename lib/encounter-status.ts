/**
 * Encounter status transitions (pure, client-safe) — Phase 1A Batch 1B.
 *
 * Defines the allowed encounter lifecycle and rejects invalid transitions. The status set
 * is the existing Phase 1 enum {open, closed, cancelled} — NO new statuses, NO inpatient/
 * emergency types (those are Phase 2). Terminal states cannot be left. No data access.
 */

export type EncounterStatus = "open" | "closed" | "cancelled";

export const ENCOUNTER_STATUSES: readonly EncounterStatus[] = [
  "open",
  "closed",
  "cancelled",
] as const;

/** Allowed next states. `open` may be closed or cancelled; closed/cancelled are terminal. */
export const VALID_TRANSITIONS: Record<EncounterStatus, readonly EncounterStatus[]> = {
  open: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function isEncounterStatus(value: string): value is EncounterStatus {
  return (ENCOUNTER_STATUSES as readonly string[]).includes(value);
}

/** True if `from → to` is an allowed transition. A no-op (`from === to`) is NOT allowed. */
export function canTransition(from: EncounterStatus, to: EncounterStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
