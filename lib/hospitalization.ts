/**
 * Hospitalization (ward-level) — pure, client-safe domain rules (Phase 2G).
 *
 * The admission state machine, daily-ward-fee validation, the discharge gate, and the deterministic
 * per-day idempotency key for daily charges. No data access, no side effects (09 §6 layering — must
 * not import `@/server`). The `AdmissionStatusCode` union MIRRORS the Prisma `AdmissionStatus` enum.
 */

/** Admission lifecycle codes (mirror of the Prisma `AdmissionStatus` enum). */
export const ADMISSION_STATUSES = [
  "requested",
  "admitted",
  "discharge_requested",
  "discharged",
  "cancelled",
] as const;

export type AdmissionStatusCode = (typeof ADMISSION_STATUSES)[number];

/** Allowed forward transitions. A doctor requests; the desk admits (assigns a ward); the doctor
 *  requests then authorises discharge. An admission can only be cancelled before a ward is assigned. */
const ADMISSION_TRANSITIONS: Record<AdmissionStatusCode, readonly AdmissionStatusCode[]> = {
  requested: ["admitted", "cancelled"],
  admitted: ["discharge_requested", "discharged"],
  discharge_requested: ["discharged"],
  discharged: [],
  cancelled: [],
};

export function isAdmissionStatus(value: string): value is AdmissionStatusCode {
  return (ADMISSION_STATUSES as readonly string[]).includes(value);
}

/** True when `to` is a permitted next state from `from`. */
export function canTransitionAdmission(from: AdmissionStatusCode, to: AdmissionStatusCode): boolean {
  return ADMISSION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Terminal states — no further transitions, no daily fees accrue. */
export function isTerminalAdmissionStatus(status: AdmissionStatusCode): boolean {
  return status === "discharged" || status === "cancelled";
}

/** Active (still-hospitalized) states — these block opening a second admission on the same encounter. */
export function isActiveAdmissionStatus(status: AdmissionStatusCode): boolean {
  return !isTerminalAdmissionStatus(status);
}

/** Validate an admission request (the clinical reason is mandatory). French messages. */
export function validateAdmissionRequest(input: { reason?: string | null }): {
  ok: boolean;
  error?: string;
} {
  if (!input.reason?.trim()) return { ok: false, error: "Le motif d'hospitalisation est obligatoire." };
  return { ok: true };
}

/** Validate a daily ward fee: a strictly-positive integer FCFA. French message. */
export function validateDailyWardFee(fee: number): { ok: boolean; error?: string } {
  if (!Number.isInteger(fee) || fee <= 0) {
    return { ok: false, error: "Le tarif journalier doit être un entier positif (FCFA)." };
  }
  return { ok: true };
}

/**
 * The discharge gate (deterministic, pure): a discharge is BLOCKED while the encounter still has
 * unpaid invoices OR outstanding emergency debt (2H). Returns the reasons so the UI/audit can show
 * exactly why. `blocked` is true iff at least one reason applies.
 */
export function computeDischargeBlock(input: {
  unpaidInvoiceCount: number;
  outstandingEmergencyDebt: number;
}): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.unpaidInvoiceCount > 0) {
    reasons.push(
      input.unpaidInvoiceCount === 1
        ? "1 facture non réglée"
        : `${input.unpaidInvoiceCount} factures non réglées`,
    );
  }
  if (input.outstandingEmergencyDebt > 0) {
    reasons.push("dette d'urgence en cours");
  }
  return { blocked: reasons.length > 0, reasons };
}

/**
 * Deterministic per-day idempotency key for a daily ward charge: the UTC calendar date `YYYY-MM-DD`.
 * Two charges with the same key (same admission, same day) collapse to one — never double-bill.
 */
export function dailyChargeDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The UTC midnight `Date` for a given day — what we store in the `@db.Date` `chargeDate` column. */
export function dailyChargeDate(date: Date): Date {
  return new Date(`${dailyChargeDateKey(date)}T00:00:00.000Z`);
}
