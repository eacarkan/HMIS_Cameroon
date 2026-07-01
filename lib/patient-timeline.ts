/**
 * Patient timeline composition (pure, client-safe) — Phase 1A Batch 1B.
 *
 * Builds a chronological, READ-ONLY timeline by composing already-persisted entities
 * (patient registration, encounters, consultations, invoices, payments). There is NO new
 * timeline persistence model — this is derived data only. No data access, no side effects.
 */

export type TimelineEventType =
  | "patient_registered"
  | "encounter_opened"
  | "encounter_closed"
  | "encounter_cancelled"
  | "consultation_recorded"
  | "invoice_created"
  | "payment_recorded";

export type TimelineEvent = {
  /** ISO timestamp used for sorting (most recent first). */
  at: string;
  type: TimelineEventType;
  /** Short reference, e.g. an encounter / invoice / receipt number. */
  ref: string | null;
};

export type TimelineInput = {
  createdAt: Date | string;
  encounters: {
    encounterNumber: string;
    status: "open" | "closed" | "cancelled";
    openedAt: Date | string;
    closedAt: Date | string | null;
    consultations: { reason: string; createdAt: Date | string }[];
    invoices: {
      invoiceNumber: string;
      createdAt: Date | string;
      payments: { receiptNumber: string; paidAt: Date | string | null }[];
    }[];
  }[];
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Compose a single chronological list (newest first) from the patient's records. */
export function composeTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({ at: iso(input.createdAt), type: "patient_registered", ref: null });

  for (const e of input.encounters) {
    events.push({ at: iso(e.openedAt), type: "encounter_opened", ref: e.encounterNumber });
    if (e.closedAt && e.status === "closed") {
      events.push({ at: iso(e.closedAt), type: "encounter_closed", ref: e.encounterNumber });
    }
    if (e.closedAt && e.status === "cancelled") {
      events.push({ at: iso(e.closedAt), type: "encounter_cancelled", ref: e.encounterNumber });
    }
    for (const c of e.consultations) {
      events.push({ at: iso(c.createdAt), type: "consultation_recorded", ref: e.encounterNumber });
    }
    for (const inv of e.invoices) {
      events.push({ at: iso(inv.createdAt), type: "invoice_created", ref: inv.invoiceNumber });
      for (const p of inv.payments) {
        if (p.paidAt) {
          events.push({ at: iso(p.paidAt), type: "payment_recorded", ref: p.receiptNumber });
        }
      }
    }
  }

  // Most recent first; stable for equal timestamps.
  return events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
