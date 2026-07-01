/**
 * Lab & radiology diagnostics — pure, client-safe domain rules (Phase 2I).
 *
 * The order state machine, the result-visibility rule (the doctor cannot see a result until it is
 * validated), and small validators. No data access, no side effects (09 §6 layering — must not import
 * `@/server`). The unions MIRROR the Prisma `DiagnosticModality` / `DiagnosticOrderStatus` enums.
 */

export const DIAGNOSTIC_MODALITIES = ["lab", "radiology"] as const;
export type DiagnosticModalityCode = (typeof DIAGNOSTIC_MODALITIES)[number];

export function isDiagnosticModality(value: string): value is DiagnosticModalityCode {
  return (DIAGNOSTIC_MODALITIES as readonly string[]).includes(value);
}

export const DIAGNOSTIC_STATUSES = [
  "requested",
  "payment_confirmed",
  "in_progress",
  "result_entered",
  "validated",
  "cancelled",
] as const;
export type DiagnosticStatusCode = (typeof DIAGNOSTIC_STATUSES)[number];

export function isDiagnosticStatus(value: string): value is DiagnosticStatusCode {
  return (DIAGNOSTIC_STATUSES as readonly string[]).includes(value);
}

/** Allowed forward transitions. `requested → in_progress` is the EMERGENCY bypass (skips payment). */
const DIAGNOSTIC_TRANSITIONS: Record<DiagnosticStatusCode, readonly DiagnosticStatusCode[]> = {
  requested: ["payment_confirmed", "in_progress", "cancelled"],
  payment_confirmed: ["in_progress", "cancelled"],
  in_progress: ["result_entered", "cancelled"],
  result_entered: ["validated", "cancelled"],
  validated: [],
  cancelled: [],
};

export function canTransitionDiagnostic(from: DiagnosticStatusCode, to: DiagnosticStatusCode): boolean {
  return DIAGNOSTIC_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalDiagnosticStatus(status: DiagnosticStatusCode): boolean {
  return status === "validated" || status === "cancelled";
}

/**
 * THE VISIBILITY RULE: a diagnostic RESULT may be shown to the requesting doctor (and other clinical
 * readers) ONLY once it is validated. Lab/radiology STAFF (technician who entered it, validator) may
 * see it earlier — they pass `isStaff = true`. Enforced server-side; this is the single source of truth.
 */
export function isResultVisible(status: DiagnosticStatusCode, isStaff: boolean): boolean {
  if (status === "validated") return true;
  return isStaff && (status === "result_entered" || status === "in_progress");
}

/** Whether the doctor (non-staff) may see the result for this status — i.e. only when validated. */
export function isResultVisibleToDoctor(status: DiagnosticStatusCode): boolean {
  return isResultVisible(status, false);
}

/** A diagnostic can start (→ in_progress) once paid OR when the encounter is an emergency (2H bypass). */
export function canStartDiagnostic(input: { status: DiagnosticStatusCode; isPaid: boolean; isEmergency: boolean }): boolean {
  if (input.status === "payment_confirmed") return true;
  if (input.status === "requested") return input.isPaid || input.isEmergency;
  return false;
}

/** Validate manual result/report text (non-empty after trim). French message. */
export function validateResultText(text: string | null | undefined): { ok: boolean; error?: string } {
  if (!text || !text.trim()) return { ok: false, error: "Le résultat ne peut pas être vide." };
  return { ok: true };
}

/** Validate a catalogue entry: code (restricted charset), French name, modality, non-negative price. */
export function validateDiagnosticCatalogueInput(input: {
  code?: string;
  nameFr?: string;
  modality?: string;
  price?: number;
}): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const code = input.code?.trim() ?? "";
  if (!code) errors.push("Le code de l'examen est obligatoire.");
  else if (!/^[A-Za-z0-9_-]+$/.test(code))
    errors.push("Le code ne doit contenir que des lettres, chiffres, tirets ou underscores.");
  if (!input.nameFr?.trim()) errors.push("Le nom (français) est obligatoire.");
  if (!input.modality || !isDiagnosticModality(input.modality)) errors.push("Modalité invalide.");
  if (input.price === undefined || !Number.isInteger(input.price) || input.price < 0) {
    errors.push("Le tarif doit être un entier positif ou nul (FCFA).");
  }
  return { ok: errors.length === 0, errors };
}
