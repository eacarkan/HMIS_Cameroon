/**
 * Consultation finalize/amend rules (pure, client-safe) — Phase 1A Batch 2.
 *
 * A consultation is either a `draft` (still editable) or `finalized`. A draft may be
 * finalized; a finalized note may only be amended (an audited correction that keeps the
 * trail) — it never returns to draft. No data access. No orders/prescriptions.
 */

export type ConsultationStatus = "draft" | "finalized";

export const CONSULTATION_STATUSES: readonly ConsultationStatus[] = [
  "draft",
  "finalized",
] as const;

export function isConsultationStatus(value: string): value is ConsultationStatus {
  return (CONSULTATION_STATUSES as readonly string[]).includes(value);
}

/** A draft can be finalized. */
export function canFinalize(status: ConsultationStatus): boolean {
  return status === "draft";
}

/** Only a finalized note can be amended (corrected with an audit trace). */
export function canAmend(status: ConsultationStatus): boolean {
  return status === "finalized";
}
