import { type AuditEntryInput, createAuditEntry } from "@/server/db";

/**
 * Audit service (09 §7). Audit entries are written here, from the service layer, as
 * part of a use-case — automatically, never by hand from the UI. Append-only.
 */

/** Canonical action codes (05 §8 / 07 §11). Stored as neutral codes. */
export const AUDIT_ACTIONS = {
  authLogin: "auth.login",
  hospitalSelect: "hospital.select",
  patientCreate: "patient.create",
  encounterCreate: "encounter.create",
  consultationCreate: "consultation.create",
  consultationUpdate: "consultation.update",
  invoiceCreate: "invoice.create",
  paymentRecord: "payment.record",
  receiptPrint: "receipt.print",
  authzDenied: "authz.denied",
} as const;

export function recordAudit(entry: AuditEntryInput) {
  return createAuditEntry(entry);
}
