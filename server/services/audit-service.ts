import {
  type AuditEntryInput,
  type HospitalContext,
  createAuditEntry,
  findAuditEntries,
} from "@/server/db";
import { AuthorizationError, can } from "@/server/authz";
import type { AuthenticatedActor } from "./auth-service";

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

/**
 * Read the audit log for the active hospital (09 §7). Read-only — requires
 * `audit.read`; a denied read throws without spamming the log with its own entry.
 */
export async function listAuditEntries(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { action?: string } = {},
) {
  if (!can(actor.roles, "audit.read")) {
    throw new AuthorizationError("audit.read");
  }
  return findAuditEntries(ctx.hospitalId, { action: opts.action, limit: 100 });
}
