/**
 * Numbering — deterministic, human-readable document numbers (05 §6, 09 §8).
 *
 * Pure formatter only. The transaction-safe counter increment lives in the
 * data-access layer (backed by the Sequence table) and is wired when the first
 * number is generated for real (Step 6+). The format is fixed here so the receipt,
 * dashboard and audit log always reconcile — e.g. `HRB-DEMO-P-2026-000001`.
 */

/** Document kinds that carry a per-hospital number. */
export type DocumentKind =
  | "patient"
  | "encounter"
  | "invoice"
  | "receipt"
  // Phase 2C — refund voucher ("avoir") and cashier shift / Brouillard de Caisse.
  | "refund_voucher"
  | "cashier_shift"
  // Phase 2D-2 — prescription ("ordonnance").
  | "prescription"
  // Phase 2D-5 — dispense record ("délivrance").
  | "dispense";

/**
 * French-mnemonic letter per kind: P patient · V visite · F facture · R reçu ·
 * A avoir (bon de remboursement) · B brouillard de caisse · O ordonnance · D délivrance.
 */
const KIND_LETTER: Record<DocumentKind, string> = {
  patient: "P",
  encounter: "V",
  invoice: "F",
  receipt: "R",
  refund_voucher: "A",
  cashier_shift: "B",
  prescription: "O",
  dispense: "D",
};

/** Zero-padded width of the per-year counter (e.g. 1 → "000001"). */
const COUNTER_WIDTH = 6;

/**
 * Format a document number: `{HOSPITAL_CODE}-{LETTER}-{YEAR}-{COUNTER}`.
 * Example: `formatDocumentNumber({ hospitalCode: "HRB-DEMO", kind: "patient",
 * year: 2026, counter: 1 })` → `"HRB-DEMO-P-2026-000001"`.
 */
export function formatDocumentNumber(params: {
  hospitalCode: string;
  kind: DocumentKind;
  year: number;
  counter: number;
}): string {
  const { hospitalCode, kind, year, counter } = params;
  if (!Number.isInteger(counter) || counter < 0) {
    throw new Error(`Invalid counter (non-negative integer): ${counter}`);
  }
  const padded = String(counter).padStart(COUNTER_WIDTH, "0");
  return `${hospitalCode}-${KIND_LETTER[kind]}-${year}-${padded}`;
}
