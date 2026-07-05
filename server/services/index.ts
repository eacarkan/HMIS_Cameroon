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

export {
  type SystemStatus,
  getDatabaseStatus,
  getSystemStatus,
} from "./system-service";
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
  type CorrectPatientIdentityInput,
  type PatientDuplicateHit,
  searchPatientsForActor,
  getPatient,
  findPatientDuplicatesForActor,
  createPatientForActor,
  createTemporaryPatient,
  correctPatientIdentity,
  auditDobValidationFailure,
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
  getTariffLineSource,
} from "./billing-service";
export { getReceipt, recordReceiptPrint } from "./receipt-service";
export {
  type DashboardSummary,
  type DashboardExtras,
  getDashboardSummary,
  getDashboardExtras,
} from "./dashboard-service";

// Phase 1 (Gate 3) — service wrappers (RBAC + hospital scoping + audit) over the Gate 2
// data-access modules. No UI; no schema change.
export {
  type ServiceConfigInput,
  listDepartments,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  listServiceUnits,
  listServiceCatalogue,
  listActiveServices,
  listActiveOutpatientConsultationServices,
  listActiveInpatientWardServices,
  createServiceUnit,
  updateServiceUnit,
  deactivateServiceUnit,
  reactivateServiceUnit,
  reorderServices,
  setServiceEligibility,
  listSettings,
  updateSetting,
  listDocumentTemplates,
  createDocumentTemplate,
  deactivateDocumentTemplate,
} from "./config-service";
// Phase 3A — multi-hospital configuration foundation (templates, instances, completeness).
export {
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type HospitalCompleteness,
  getConfigurationCompleteness,
  recomputeConfigurationCompleteness,
  listAccessibleHospitalCompleteness,
  compareTwoHospitals,
  listTemplates,
  createTemplate,
  updateTemplate,
  applyTemplate,
  listTemplateApplications,
  overrideInstanceSetting,
} from "./hospital-configuration-service";
// Phase 3B/3D — central aggregate oversight (cross-hospital, aggregate-only, audited; snapshot-fed only).
export {
  type SnapshotIndicators,
  type CentralOversightHospital,
  generateHospitalAggregateSnapshot,
  getCentralOversight,
} from "./central-oversight-service";
// Phase 3C — site-readiness & deployment checklist (status tracking only; hospital-scoped).
export {
  type SiteReadinessView,
  type SetReadinessInput,
  getSiteReadiness,
  setReadinessItem,
} from "./site-readiness-service";
// Phase 3E — UAT evidence + Gate 7 readiness (evidence only; hospital-scoped; audited).
export {
  type UatEvidenceView,
  type UatScenarioView,
  type Gate7ItemView,
  getUatEvidence,
  recordUatExecution,
  setGate7Item,
  setGate7Signoff,
} from "./uat-gate7-service";
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
  listDiagnosisCodes,
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
} from "./reports-service";

// Phase 2C — cancellation workflow, refund vouchers, persisted Brouillard de Caisse.
export {
  listCancellations,
  getCancellation,
  requestInvoiceCancellation,
  approveInvoiceCancellation,
  rejectInvoiceCancellation,
} from "./cancellation-service";
export {
  listRefunds,
  getRefund,
  approveRefund,
  executeRefund,
  cancelRefund,
} from "./refund-service";
export {
  getOpenShift,
  getCashierShift,
  listShifts,
  previewShiftTotals,
  openCashierShift,
  closeCashierShift,
  correctCashierShift,
} from "./cashier-shift-service";

// Phase 2D-1 — medication catalogue.
export {
  listMedicationCatalogue,
  listActiveMedications,
  createMedication,
  updateMedication,
  deactivateMedication,
  reactivateMedication,
} from "./medication-service";

// Phase 2D-2 — prescriptions.
export {
  type CreatePrescriptionInput,
  getPrescription,
  listPrescriptionsForEncounter,
  listPrescriptions,
  createPrescription,
  finalizePrescription,
  sendPrescriptionToPharmacy,
  cancelPrescription,
} from "./prescription-service";

// Phase 2D-3 — medication stock.
export {
  type StockSummaryRow,
  listStock,
  getStockSummary,
  receiveStockBatch,
} from "./stock-service";

// Phase 2D-4 — stock reservations (reserve on send; release on cancel / 48h sweep).
export {
  reserveForPrescription,
  releaseReservationsForPrescription,
  listPrescriptionReservations,
  releaseStaleReservations,
} from "./reservation-service";

// Phase 2D-5 — dispensing (paid-check → consume reservations → deduct on-hand).
export {
  getPharmacyWorklist,
  getDispenseRecord,
  listDispensesForPrescription,
  confirmPrescriptionPayment,
  dispensePrescription,
} from "./dispensing-service";

// Phase 2D-6 — FEFO override (Pharmacist-in-Charge re-points a reservation to a chosen non-FEFO batch).
export {
  getReservationOverrideOptions,
  overrideReservationBatch,
} from "./fefo-service";

// Phase 2D-7 — dual-validated stock adjustments (pharmacist requests; Pharmacist-in-Charge decides).
export {
  listStockAdjustmentsForActor,
  getStockAdjustment,
  requestStockAdjustment,
  approveStockAdjustment,
  rejectStockAdjustment,
} from "./stock-adjustment-service";

// Phase 2D-8 — read-only pharmacy reporting (stock levels / low / expiring / dispensing volume).
export {
  type PharmacyReport,
  type StockLevelRow,
  type ExpiringLotRow,
  getPharmacyReport,
} from "./pharmacy-report-service";

// Phase 2E — operational reporting + DHIS2-aligned aggregate CSV export (no patient identifiers).
export { getOperationalReport, exportDhis2Csv } from "./operational-report-service";

// Phase 2F — simple per-service digital queue.
export {
  getQueueForService,
  addToQueue,
  advanceQueueTicket,
  setQueueUrgent,
} from "./queue-service";

// Phase 2H — emergency exception + emergency-debt ledger.
export {
  flagEncounterEmergency,
  accrueEmergencyDebt,
  settleEmergencyDebt,
  waiveEmergencyDebt,
  getEmergencyDebtSummary,
} from "./emergency-service";

// Phase 2G — ward-level hospitalization (admission + daily ward fee).
export {
  requestAdmission,
  assignWard,
  cancelAdmission,
  requestDischarge,
  authorizeDischarge,
  generateDailyWardCharge,
  getAdmissionForEncounter,
  listHospitalAdmissions,
} from "./hospitalization-service";

// Phase 2I — manual lab & radiology (catalogue + order lifecycle + validation gate + report).
export {
  listDiagnosticCatalogueAll,
  listOrderableDiagnostics,
  createDiagnosticCatalogueItem,
  setDiagnosticCatalogueItemActive,
  requestDiagnostic,
  confirmDiagnosticPayment,
  startDiagnostic,
  enterDiagnosticResult,
  validateDiagnosticResult,
  cancelDiagnostic,
  getDiagnosticOrder,
  listDiagnosticsForEncounter,
  getDiagnosticWorklist,
  getDiagnosticReport,
} from "./diagnostic-service";
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

// Phase 4A — integration framework & external-system registry (mock/sandbox-first; no live calls; audited).
export {
  type IntegrationOverview,
  getIntegrationOverview,
  getIntegrationJob,
  createExternalSystemForActor,
  setExternalSystemStatusForActor,
  configureConnectorForActor,
  setExternalSystemConfigForActor,
  addCredentialReferenceForActor,
  runIntegrationJobForActor,
  retryIntegrationJobForActor,
} from "./integration-service";

// Phase 4B — DHIS2 configurable export / API-readiness (aggregate-only; mock API; audited).
export {
  getDhis2MappingAdmin,
  createDhis2MappingSetForActor,
  upsertDhis2MappingForActor,
  getDhis2ExportReadiness,
  exportDhis2MappedCsv,
  runDhis2MockApiExport,
} from "./dhis2-mapping-service";

// Phase 4C — external lab/radiology result import (staging + review; importer ≠ reviewer; audited).
export {
  importExternalResults,
  getExternalResultQueue,
  reviewExternalResult,
} from "./external-result-service";

// Phase 4D — payment provider abstraction + reconciliation (mock only; reconcile via existing rule; audited).
export {
  getExternalPaymentAdmin,
  createPaymentProviderForActor,
  createMockPaymentIntent,
  confirmMockPayment,
  failMockPayment,
  cancelMockPayment,
  reconcileExternalPayment,
} from "./external-payment-service";

// Phase 4E — insurance / mutuelle workflow foundation (manual only; billing-linked; audited).
export {
  getInsuranceAdmin,
  createPayerForActor,
  createCoverageProfileForActor,
  linkPatientCoverageForActor,
  setEligibilityPlaceholderForActor,
  requestPreAuthForActor,
  decidePreAuthForActor,
  createClaimDraftForActor,
  transitionClaimForActor,
} from "./insurance-service";

// Phase 4F — advanced reporting / analytics foundation (aggregate-only; no AI; hospital-scoped; audited).
export {
  getAnalyticsAdmin,
  createReportDefinitionForActor,
  setReportDefinitionActiveForActor,
  runReportForActor,
  exportReportRunForActor,
} from "./analytics-report-service";

// Phase 4G — patient-matching / MPI readiness (local, warning-only, manual review, no auto-merge; audited).
export {
  getPatientMatchReview,
  generateMatchCandidatesForActor,
  startMatchReviewForActor,
  recordMatchDecisionForActor,
  runMockMpiCheckForActor,
} from "./patient-match-service";

// Phase 6C / 6.1 — one-click demo login REQUEST audit (synthetic accounts only).
export { recordDemoSessionRequest } from "./demo-service";

// Phase 6.6 — finance / bank reconciliation (Mobile-Money report; aging; deposit reconciliation; statement).
export { getMobileMoneyReport } from "./momo-report-service";
export { getReceivablesAging } from "./receivables-service";
export {
  getReconciliationOverview,
  getDepositSlipDetail,
  createDepositSlip,
  linkPaymentToSlip,
  unlinkPaymentFromSlip,
  importSyntheticBankStatement,
  matchBankLineToSlip,
  changeDepositSlipStatus,
} from "./reconciliation-service";
export { getRevenueStatement, generateRevenueStatementNumber } from "./revenue-statement-service";

/** Marker for a use-case that is intentionally not built yet. */
export function notImplemented(useCase: string): never {
  throw new Error(`Use-case not implemented yet: ${useCase}`);
}
