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
  searchPatients,
  searchPatientsAdvanced,
  findPotentialDuplicatePatients,
  findPatientById,
} from "./patients";
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
} from "./invoices";
export {
  countPatientsRegisteredSince,
  countOpenEncounters,
  sumCollectionsSince,
  recentAuditEntries,
} from "./dashboard";

// Phase 1 (Gate 2 + Gate 3) — additive hospital-scoped data-access for the new models.
export {
  type CreateDepartmentData,
  type CreateServiceUnitData,
  type CreateDocumentTemplateData,
  listDepartments,
  listServiceUnits,
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
