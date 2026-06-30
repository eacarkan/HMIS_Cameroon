import {
  type AuditEntryInput,
  type HospitalContext,
  createAuditEntry,
  findAuditEntries,
  findAuditEntryById,
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
  // Phase 1A (Batch 1B) — encounter lifecycle (status history via append-only audit; no new table).
  encounterStatusChange: "encounter.status_change",
  encounterAssign: "encounter.assign",
  consultationCreate: "consultation.create",
  consultationUpdate: "consultation.update",
  // Phase 1A (Batch 2) — clinical note finalize / amend (amendment trace via append-only audit).
  consultationFinalize: "consultation.finalize",
  consultationAmend: "consultation.amend",
  invoiceCreate: "invoice.create",
  paymentRecord: "payment.record",
  receiptPrint: "receipt.print",
  // Phase 1A (Batch 3) — billing/cashier financial-integrity controls.
  invoiceVoid: "invoice.void",
  receiptReprint: "receipt.reprint",
  cashierShiftClose: "cashier.shift_close",
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
  // Phase 1 (Gate 5B) — cashier reporting, user lifecycle, logout.
  authLogout: "auth.logout",
  cashierDailyReport: "cashier.daily_report.generate",
  userCreate: "user.create",
  userActivate: "user.activate",
  userDeactivate: "user.deactivate",
  roleAssign: "role.assign",
  roleRemove: "role.remove",
  // Phase 1A (Batch 4) — account security.
  authPasswordChange: "auth.password_change",
  authPasswordReset: "auth.password_reset",
  sensitiveRead: "sensitive.read",
  // Phase 3A — multi-hospital configuration foundation (templates, instances, completeness).
  // Every event carries the actor + the hospital instance affected; config changes only
  // (no patient/transaction data). `applied`/`instance_updated`/`completeness_recomputed`
  // are hospital-scoped; template create/update act on the shared blueprint.
  configTemplateCreated: "config.template.created",
  configTemplateUpdated: "config.template.updated",
  configTemplateApplied: "config.template.applied",
  configInstanceUpdated: "config.instance.updated",
  configCompletenessRecomputed: "config.completeness.recomputed",
  // Phase 2A — service/department catalogue configuration (capability-based; admin only).
  serviceCreated: "service.created",
  serviceUpdated: "service.updated",
  serviceDeactivated: "service.deactivated",
  serviceReactivated: "service.reactivated",
  serviceReordered: "service.reordered",
  serviceEligibilityChanged: "service.eligibility_changed",
  // Phase 2B — patient identity (temporary patient + identity correction; a recorded
  // diagnosis reuses `diagnosis.create`). The original temporary ID is retained in the audit.
  patientTemporaryCreated: "patient.temporary_created",
  patientIdentityUpdated: "patient.identity_updated",
  // Phase 2C — cancellation workflow, refund voucher, Brouillard de Caisse. Append-only;
  // every money-affecting action carries actor + hospital + amounts (in the French summary).
  invoiceCancellationRequested: "invoice.cancellation_requested",
  invoiceCancellationApproved: "invoice.cancellation_approved",
  invoiceCancellationRejected: "invoice.cancellation_rejected",
  refundVoucherCreated: "refund_voucher.created",
  refundVoucherApproved: "refund_voucher.approved",
  refundVoucherExecuted: "refund_voucher.executed",
  refundVoucherCancelled: "refund_voucher.cancelled",
  cashierShiftOpened: "cashier.shift_opened",
  cashierShiftClosed: "cashier.shift_closed",
  cashierClosingCorrected: "cashier.closing_corrected",
  // Phase 2D-1 — medication catalogue (hospital-scoped; admin-managed).
  medicationCreated: "medication.created",
  medicationUpdated: "medication.updated",
  medicationDeactivated: "medication.deactivated",
  medicationReactivated: "medication.reactivated",
  // Phase 2D-2 — prescription lifecycle (no stock effect here).
  prescriptionCreated: "prescription.created",
  prescriptionFinalized: "prescription.finalized",
  prescriptionSentToPharmacy: "prescription.sent_to_pharmacy",
  prescriptionCancelled: "prescription.cancelled",
  // Phase 2D-3 — stock batches.
  stockBatchReceived: "stock.batch_received",
  // Phase 2D-4 — stock reservations (reserve on send-to-pharmacy; release on cancel / 48h sweep).
  reservationCreated: "reservation.created",
  reservationReleased: "reservation.released",
  // Phase 2D-5 — collection payment confirmation + dispensing (deducts on-hand).
  prescriptionPaymentConfirmed: "prescription.payment_confirmed",
  dispenseCompleted: "dispense.completed",
  // Phase 2D-6 — Pharmacist-in-Charge authorised a deviation from FEFO (chosen non-earliest batch).
  fefoOverride: "fefo.override",
  // Phase 2D-7 — dual-validated stock adjustments (pharmacist requests; Pharmacist-in-Charge decides).
  stockAdjustmentRequested: "stock.adjustment_requested",
  stockAdjustmentApproved: "stock.adjustment_approved",
  stockAdjustmentRejected: "stock.adjustment_rejected",
  // Phase 2E — manual aggregate (DHIS2-aligned) CSV export. Records period + scope + row count only.
  reportExportedCsv: "report.exported_csv",
  // Phase 2F — per-service digital queue.
  queueTicketCreated: "queue.ticket_created",
  queueStatusChanged: "queue.status_changed",
  queueMarkedUrgent: "queue.marked_urgent",
  // Phase 2H — emergency exception + emergency-debt ledger.
  emergencyFlagged: "emergency.flagged",
  emergencyDebtAccrued: "emergency.debt_accrued",
  emergencyDebtSettled: "emergency.debt_settled",
  emergencyDebtWaived: "emergency.debt_waived",
  // Phase 2G — ward-level hospitalization.
  admissionRequested: "admission.requested",
  admissionWardAssigned: "admission.ward_assigned",
  admissionCancelled: "admission.cancelled",
  admissionDischargeRequested: "admission.discharge_requested",
  admissionDischarged: "admission.discharged",
  admissionDailyFeeCharged: "admission.daily_fee_charged",
  // Phase 2I — manual lab & radiology.
  diagnosticCatalogueChanged: "diagnostic.catalogue_changed",
  diagnosticRequested: "diagnostic.requested",
  diagnosticPaymentConfirmed: "diagnostic.payment_confirmed",
  diagnosticStarted: "diagnostic.started",
  diagnosticResultEntered: "diagnostic.result_entered",
  diagnosticValidated: "diagnostic.validated",
  diagnosticCancelled: "diagnostic.cancelled",
  diagnosticPdfGenerated: "diagnostic.pdf_generated",
} as const;

/**
 * Sensitive-read audit hook (Phase 1A Batch 4) — WIRED BUT INERT. Logging which users read
 * which sensitive records is a privacy decision for the MINSANTE (`à confirmer par le
 * MINSANTE`). Until that policy is set, this flag stays `false` and `recordSensitiveRead`
 * is a no-op. Activating it must be a deliberate, reviewed change — not done here.
 */
export const SENSITIVE_READ_AUDIT_ENABLED = false;

/** Inert by default — records a `sensitive.read` audit ONLY if the policy is activated. */
export async function recordSensitiveRead(entry: {
  hospitalId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  summary: string;
}) {
  if (!SENSITIVE_READ_AUDIT_ENABLED) return; // pending MINSANTE policy — no-op
  await recordAudit({
    hospitalId: entry.hospitalId,
    actorId: entry.actorId,
    action: AUDIT_ACTIONS.sensitiveRead,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
  });
}

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

/** Read a single audit entry (detail view). Requires `audit.read`; hospital-scoped. */
export async function getAuditEntry(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  if (!can(actor.roles, "audit.read")) {
    throw new AuthorizationError("audit.read");
  }
  return findAuditEntryById(ctx.hospitalId, id);
}
