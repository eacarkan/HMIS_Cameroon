/**
 * `server/services` — the business-logic layer (09 §2, §4).
 *
 * The ONLY place domain rules live. Each use-case here will:
 *   1. receive validated input from a thin `server/actions` transport boundary,
 *   2. enforce authorization (`server/authz`) for actor + role + hospital,
 *   3. enforce hospital scoping, and
 *   4. write the audit entry,
 * before calling hospital-scoped data-access (`server/db`). Services never touch
 * Prisma directly and the UI never imports `server/db` directly.
 *
 * FOUNDATIONS (Steps 1-2): only the infrastructure `system-service` is real. All
 * domain services are added one build step at a time (patients → encounters →
 * consultations → billing → …). Use `notImplemented()` to stub a use-case so a
 * called-too-early path fails loudly instead of silently doing nothing.
 */

export { getDatabaseStatus } from "./system-service";
export {
  type AuthenticatedActor,
  authenticateCredentials,
  changeOwnPassword,
} from "./auth-service";
export {
  AUDIT_ACTIONS,
  recordAudit,
  recordSensitiveRead,
  SENSITIVE_READ_AUDIT_ENABLED,
  listAuditEntries,
  getAuditEntry,
} from "./audit-service";
export { requireCapability } from "./authz-service";
export {
  getAccessibleHospitals,
  resolveHospitalContext,
  selectHospital,
} from "./hospital-service";
export { generateNumber } from "./numbering-service";
export {
  type CreatePatientInput,
  type PatientDuplicateHit,
  searchPatientsForActor,
  getPatient,
  findPatientDuplicatesForActor,
  createPatientForActor,
} from "./patient-service";
export {
  type OpenEncounterInput,
  getEncounter,
  openEncounter,
  changeEncounterStatus,
  assignEncounterService,
  getEncounterStatusHistory,
  getPatientTimeline,
} from "./encounter-service";
export {
  type RecordConsultationInput,
  type AmendConsultationInput,
  recordConsultation,
  getConsultation,
  getConsultationHistory,
  finalizeConsultation,
  amendConsultation,
} from "./consultation-service";
export {
  type InvoiceLineInput,
  invoiceBalance,
  getInvoice,
  createInvoice,
  recordPayment,
  voidInvoice,
  getTariffLineSource,
} from "./billing-service";
export { getReceipt, recordReceiptPrint } from "./receipt-service";
export {
  type DashboardSummary,
  getDashboardSummary,
} from "./dashboard-service";

// Phase 1 (Gate 3) — service wrappers (RBAC + hospital scoping + audit) over the Gate 2
// data-access modules. No UI; no schema change.
export {
  listDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  listServiceUnits,
  createServiceUnit,
  deactivateServiceUnit,
  listSettings,
  updateSetting,
  listDocumentTemplates,
  createDocumentTemplate,
  deactivateDocumentTemplate,
} from "./config-service";
export {
  listPatientContacts,
  addPatientContact,
  deactivatePatientContact,
  listPatientIdentifiers,
  addPatientIdentifier,
  deactivatePatientIdentifier,
  listDuplicateCandidatesForActor,
  flagDuplicateCandidate,
  reviewDuplicateCandidate,
} from "./patient-identity-service";
export {
  listObservations,
  addObservation,
  updateObservation,
  listDiagnoses,
  addDiagnosis,
  updateDiagnosis,
} from "./clinical-structure-service";
export {
  listPriceLists,
  createPriceList,
  deactivatePriceList,
  listTariffs,
  createTariff,
  updateTariff,
  deactivateTariff,
} from "./tariff-service";

// Phase 1 (Gate 5B) — cashier daily report + export, and user/account lifecycle.
export {
  type CashierReportRow,
  type CashierDailyReport,
  type CashierReportFilters,
  type CashierShiftSummary,
  getCashierDailyReport,
  exportCashierDailyReportCsv,
  getCashierShiftSummary,
  closeCashierShift,
} from "./reports-service";
export {
  listUsers,
  createUserForActor,
  setUserActive,
  assignRoleForActor,
  removeRoleForActor,
  resetUserPassword,
  LAST_ADMIN_ERROR,
  SELF_DEACTIVATE_ERROR,
  SELF_ADMIN_REMOVAL_ERROR,
} from "./user-admin-service";

/** Marker for a use-case that is intentionally not built yet. */
export function notImplemented(useCase: string): never {
  throw new Error(`Use-case not implemented yet: ${useCase}`);
}
