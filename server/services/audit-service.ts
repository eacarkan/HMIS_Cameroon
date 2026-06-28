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
  // Phase 1 (Gate 3) — configuration / master data.
  departmentCreate: "department.create",
  departmentUpdate: "department.update",
  departmentDeactivate: "department.deactivate",
  serviceUnitCreate: "service_unit.create",
  serviceUnitUpdate: "service_unit.update",
  serviceUnitDeactivate: "service_unit.deactivate",
  settingUpdate: "setting.update",
  documentTemplateCreate: "document_template.create",
  documentTemplateUpdate: "document_template.update",
  documentTemplateDeactivate: "document_template.deactivate",
  // Phase 1 (Gate 3) — patient identity / contact.
  patientContactCreate: "patient_contact.create",
  patientContactUpdate: "patient_contact.update",
  patientContactDeactivate: "patient_contact.deactivate",
  patientIdentifierCreate: "patient_identifier.create",
  patientIdentifierUpdate: "patient_identifier.update",
  patientIdentifierDeactivate: "patient_identifier.deactivate",
  patientDuplicateWarning: "patient_duplicate.warning",
  patientDuplicateReview: "patient_duplicate.review",
  // Phase 1 (Gate 3) — clinical structure.
  observationCreate: "observation.create",
  observationUpdate: "observation.update",
  diagnosisCreate: "diagnosis.create",
  diagnosisUpdate: "diagnosis.update",
  // Phase 1 (Gate 3) — tariff / price list.
  priceListCreate: "price_list.create",
  priceListUpdate: "price_list.update",
  priceListDeactivate: "price_list.deactivate",
  tariffCreate: "tariff.create",
  tariffUpdate: "tariff.update",
  tariffDeactivate: "tariff.deactivate",
  invoiceItemTariffSourceUsed: "invoice_item.tariff_source_used",
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
