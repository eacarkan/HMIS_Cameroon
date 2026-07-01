/**
 * Phase 4D — pure helpers for the payment-provider abstraction (no I/O, no server imports). Provider +
 * transaction input validation and the external-payment status machine. Integer FCFA. A confirmation
 * never touches the invoice — reconciliation (elsewhere) records a controlled Payment via the existing
 * billing rule. Mock only; no real provider API.
 */

export type ExternalPaymentStatusCode = "PENDING" | "CONFIRMED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";
export const EXTERNAL_PAYMENT_STATUSES: readonly ExternalPaymentStatusCode[] = [
  "PENDING",
  "CONFIRMED",
  "FAILED",
  "CANCELLED",
  "NEEDS_REVIEW",
];

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result = Ok | Err;

export function validateProviderInput(input: { code: string; name: string; channel: string }): Result {
  if (!CODE_RE.test(input.code?.trim() ?? "")) {
    return { ok: false, error: "Le code du prestataire doit être en MAJUSCULES (2 à 40 caractères)." };
  }
  if (!input.name?.trim()) return { ok: false, error: "Le nom du prestataire est obligatoire." };
  if (!input.channel?.trim()) return { ok: false, error: "Le canal (ex. MOBILE_MONEY) est obligatoire." };
  return { ok: true };
}

export function validateTransactionInput(input: { externalReference: string; amount: number }): Result {
  if (!input.externalReference?.trim()) return { ok: false, error: "La référence de transaction est obligatoire." };
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Le montant doit être un entier positif (FCFA)." };
  }
  return { ok: true };
}

/** A mock confirmation is allowed only from PENDING. */
export function canConfirm(status: ExternalPaymentStatusCode): boolean {
  return status === "PENDING";
}

/** A PENDING transaction can be failed or cancelled. */
export function canFailOrCancel(status: ExternalPaymentStatusCode): boolean {
  return status === "PENDING";
}

/** Reconciliation is allowed only for a CONFIRMED transaction that is not yet reconciled. */
export function canReconcile(status: ExternalPaymentStatusCode, reconciledPaymentId: string | null): boolean {
  return status === "CONFIRMED" && !reconciledPaymentId;
}

export function isTerminalPaymentStatus(status: ExternalPaymentStatusCode): boolean {
  return status === "FAILED" || status === "CANCELLED";
}
