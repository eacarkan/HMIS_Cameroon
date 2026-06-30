/**
 * `server/db` — the hospital-scoped data-access layer.
 *
 * Responsibility (09 §2): the ONLY place Prisma is called. Every domain function
 * added here from Step 3+ takes a `HospitalContext` and filters by it. Consumers
 * are `server/services` — never the UI, components, features, or pages (enforced by
 * ESLint `no-restricted-imports`).
 */
export { prisma } from "./prisma";
export { type HospitalContext } from "./hospital-context";
export { pingDatabase } from "./health";
export {
  type CreateUserRecordData,
  findUserByEmailWithRoles,
  findUserByIdWithRoles,
  listUsersForHospital,
  createUserRecord,
  setUserStatus,
  updateUserPassword,
  findRoleByCode,
  findUserRoleInHospital,
  assignUserRole,
  removeUserRole,
  userHasRoleInHospital,
  countActiveUsersWithRoleInHospital,
  countRoleAssignmentsInHospital,
} from "./users";
export { findPaymentsForDay } from "./reports";
export {
  type AuditEntryInput,
  createAuditEntry,
  findAuditEntries,
  findEntityAuditTrail,
  findAuditEntryById,
} from "./audit";
export { findHospitalsForUser, findHospitalById } from "./hospitals";
export { nextSequenceValue } from "./sequence";
export {
  type CreatePatientData,
  type PatientSearchFilters,
  createPatient,
  updatePatient,
  countTemporaryPatientsForDay,
  listTemporaryIdentifiersForDay,
  searchPatients,
  searchPatientsAdvanced,
  findPotentialDuplicatePatients,
  findPatientById,
  findPatientByNumber,
} from "./patients";
export { listActiveDiagnosisCodes, findDiagnosisCodeByCode } from "./diagnosis-codes";
export {
  type CreateEncounterData,
  createEncounter,
  findEncounterById,
  updateEncounterStatus,
  updateEncounterService,
  findPatientTimelineData,
} from "./encounters";
export {
  type CreateConsultationData,
  type UpdateConsultationData,
  createConsultation,
  findConsultationById,
  updateConsultation,
  findConsultationDetail,
} from "./consultations";
export {
  type CreateInvoiceWithItemsData,
  type CreatePaymentData,
  createInvoiceWithItems,
  findInvoiceById,
  createPayment,
  updateInvoiceStatus,
  updatePaymentStatus,
  markReceiptPrinted,
  findPaymentById,
  listOpenInvoicesForEncounter,
} from "./invoices";
export {
  countPatientsRegisteredSince,
  countOpenEncounters,
  sumCollectionsSince,
  countEncountersOpenedSince,
  countEncountersClosedSince,
  countConsultationsSince,
  countInvoicesSince,
  findPaymentsSince,
  recentAuditEntries,
} from "./dashboard";

// Phase 1 (Gate 2 + Gate 3) — additive hospital-scoped data-access for the new models.
export {
  type CreateDepartmentData,
  type CreateServiceUnitData,
  type ServiceCatalogueFields,
  type CreateDocumentTemplateData,
  listDepartments,
  listServiceUnits,
  listServiceUnitsOrdered,
  listActiveServiceUnits,
  listActiveOutpatientConsultationServices,
  findActiveOutpatientConsultationServiceByLabel,
  reorderServiceUnits,
  listActiveInpatientWardServices,
  findActiveInpatientWardServiceById,
  listSettings,
  getSetting,
  listDocumentTemplates,
  createDepartment,
  findDepartmentById,
  updateDepartment,
  createServiceUnit,
  findServiceUnitById,
  updateServiceUnit,
  upsertSetting,
  createDocumentTemplate,
  findDocumentTemplateById,
  updateDocumentTemplate,
} from "./config";

// Phase 3A — multi-hospital configuration foundation (templates, guarded apply, completeness summary).
export {
  type CreateConfigurationTemplateData,
  type UpdateConfigurationTemplateData,
  type ApplyTemplateResult,
  listConfigurationTemplates,
  findConfigurationTemplateById,
  findConfigurationTemplateByCode,
  createConfigurationTemplate,
  updateConfigurationTemplate,
  listConfigurationTemplateApplications,
  applyTemplateToHospital,
  gatherHospitalConfigSummary,
} from "./configuration-templates";

// Phase 3B/3D — central aggregate oversight (cross-hospital, aggregate-only; snapshot-fed in 3D).
export {
  type CentralHospitalAggregate,
  gatherCentralAggregates,
  gatherSnapshotCounts,
  upsertHospitalAggregateSnapshot,
  listLatestHospitalSnapshots,
} from "./central-oversight";

// Phase 3C — site-readiness checklist (hospital-scoped status tracking).
export {
  type UpsertSiteReadinessData,
  listSiteReadinessItems,
  upsertSiteReadinessItem,
} from "./site-readiness";

// Phase 3E — UAT evidence + Gate 7 readiness (hospital-scoped; evidence only).
export {
  type UpsertGate7Data,
  listUatScenariosWithExecutions,
  countUatScenarios,
  upsertUatScenario,
  findUatScenarioByCode,
  upsertUatExecution,
  listGate7Items,
  upsertGate7Item,
} from "./uat-gate7";
export {
  type CreatePriceListData,
  type CreateTariffData,
  listPriceLists,
  listTariffs,
  findTariffByCode,
  createPriceList,
  findPriceListById,
  updatePriceList,
  createTariff,
  findTariffById,
  updateTariff,
} from "./tariffs";
export {
  type CreatePatientContactData,
  type CreatePatientIdentifierData,
  type CreateDuplicateCandidateData,
  createPatientContact,
  listPatientContacts,
  findPatientContactById,
  updatePatientContact,
  createPatientIdentifier,
  listPatientIdentifiers,
  findPatientIdentifier,
  findPatientIdentifierById,
  updatePatientIdentifier,
  createDuplicateCandidate,
  listDuplicateCandidates,
  findDuplicateCandidateById,
  updateDuplicateCandidateStatus,
} from "./patient-identity";
export {
  type CreateObservationData,
  type CreateDiagnosisData,
  createObservation,
  listObservations,
  findObservationById,
  updateObservation,
  createDiagnosis,
  listDiagnoses,
  findDiagnosisById,
  updateDiagnosis,
} from "./clinical-structure";

// Phase 2C — cancellation workflow, refund vouchers, cashier shifts / Brouillard de Caisse.
export {
  type CreateCancellationRequestData,
  createCancellationRequest,
  findCancellationRequestById,
  listCancellationRequests,
  findPendingCancellationForInvoice,
  updateCancellationDecision,
  approveCancellationTx,
} from "./cancellations";
export {
  type CreateRefundVoucherData,
  createRefundVoucher,
  findRefundVoucherById,
  listRefundVouchers,
  findExecutedRefundsForWindow,
  updateRefundVoucher,
} from "./refunds";
export {
  type CreateCashierShiftData,
  type CreateShiftCorrectionData,
  createCashierShift,
  findOpenCashierShift,
  findCashierShiftById,
  listCashierShifts,
  findCashierPaymentsForWindow,
  closeCashierShiftRow,
  markCashierShiftCorrected,
  createShiftCorrection,
} from "./cashier-shifts";

// Phase 2D-1 — medication catalogue.
export {
  type CreateMedicationData,
  listMedications,
  listActiveMedications,
  findMedicationById,
  findMedicationByCode,
  createMedication,
  updateMedication,
} from "./medications";

// Phase 2D-2 — prescriptions.
export {
  type CreatePrescriptionData,
  createPrescriptionWithItems,
  findPrescriptionById,
  listPrescriptionsForEncounter,
  listPrescriptions,
  updatePrescriptionStatus,
  setPrescriptionPaid,
  listPharmacyWorklist,
} from "./prescriptions";

// Phase 2D-5 — dispense records.
export {
  type CreateDispenseRecordData,
  type DispenseLine,
  type DispenseTxResult,
  createDispenseRecordWithItems,
  dispenseReservationsForPrescription,
  findDispenseRecordById,
  listDispenseRecordsForPrescription,
  sumDispensedByPrescriptionItem,
} from "./dispensing";

// Phase 2D-3 — medication stock batches.
export {
  type CreateStockBatchData,
  createStockBatch,
  listStockBatches,
  listStockForMedication,
  findStockBatchById,
  adjustStockBatch,
  incrementStockBatch,
} from "./stock";

// Phase 2D-4 — stock reservations.
export {
  type CreateReservationData,
  createReservation,
  listReservationsForPrescription,
  listActiveReservationsForItem,
  findReservationById,
  findActiveReservationsOlderThan,
  setReservationStatus,
  overrideReservationBatch,
} from "./reservations";

// Phase 2D-7 — dual-validated stock adjustments.
export {
  type CreateStockAdjustmentData,
  createStockAdjustment,
  findStockAdjustmentById,
  listStockAdjustments,
  rejectStockAdjustmentRow,
  approveStockAdjustmentTx,
} from "./stock-adjustments";

// Phase 2D-8 — read-only pharmacy reporting.
export { listDispenseItemsSince, countDispenseRecordsSince } from "./pharmacy-reports";

// Phase 2E — operational reporting + DHIS2 aggregate export history.
export {
  type CreateReportExportData,
  listConsultationDemographicsForPeriod,
  listRecordedPaymentsForPeriod,
  createReportExport,
  listReportExports,
} from "./operational-reports";

// Phase 2F — per-service digital queue.
export {
  type CreateQueueTicketData,
  createQueueTicket,
  findQueueTicketById,
  listQueueForService,
  updateQueueTicketStatus,
  setQueueTicketUrgent,
} from "./queue-tickets";

// Phase 2G — ward-level hospitalization (admission + daily ward fee).
export {
  type CreateAdmissionData,
  type DailyChargeTxResult,
  createAdmissionTx,
  findAdmissionById,
  findLatestAdmissionForEncounter,
  findActiveAdmissionForEncounter,
  listAdmissions,
  assignWardTx,
  cancelAdmissionTx,
  requestDischargeTx,
  authorizeDischargeTx,
  listDailyChargesForAdmission,
  accrueDailyChargeTx,
} from "./hospitalization";

// Phase 2I — manual lab & radiology (catalogue + order lifecycle).
export {
  type CreateDiagnosticCatalogueItemData,
  type CreateDiagnosticOrderData,
  listDiagnosticCatalogue,
  listActiveDiagnosticCatalogue,
  findDiagnosticCatalogueItemById,
  createDiagnosticCatalogueItem,
  updateDiagnosticCatalogueItem,
  createDiagnosticOrder,
  findDiagnosticOrderById,
  listDiagnosticOrdersForEncounter,
  listDiagnosticWorklist,
  confirmDiagnosticPaymentTx,
  startDiagnosticTx,
  enterDiagnosticResultTx,
  validateDiagnosticResultTx,
  cancelDiagnosticTx,
} from "./diagnostics";

// Phase 2H — emergency exception + emergency-debt ledger.
export {
  type CreateEmergencyDebtData,
  setEncounterEmergency,
  createEmergencyDebt,
  accrueEmergencyDebtTx,
  unflagEncounterEmergencyTx,
  findEmergencyDebtById,
  listEmergencyDebtsForEncounter,
  decideEmergencyDebt,
  countOutstandingEmergencyDebt,
} from "./emergency";
