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
export { findUserByEmailWithRoles, findUserByIdWithRoles } from "./users";
export {
  type AuditEntryInput,
  createAuditEntry,
  findAuditEntries,
} from "./audit";
export { findHospitalsForUser, findHospitalById } from "./hospitals";
export { nextSequenceValue } from "./sequence";
export {
  type CreatePatientData,
  createPatient,
  searchPatients,
  findPatientById,
} from "./patients";
export {
  type CreateEncounterData,
  createEncounter,
  findEncounterById,
} from "./encounters";
export {
  type CreateConsultationData,
  createConsultation,
} from "./consultations";
export {
  type CreateInvoiceWithItemsData,
  type CreatePaymentData,
  createInvoiceWithItems,
  findInvoiceById,
  createPayment,
  updateInvoiceStatus,
  markReceiptPrinted,
  findPaymentById,
} from "./invoices";
export {
  countPatientsRegisteredSince,
  countOpenEncounters,
  sumCollectionsSince,
  recentAuditEntries,
} from "./dashboard";

// Phase 1 (Gate 2) — additive hospital-scoped data-access for the new models.
export {
  listDepartments,
  listServiceUnits,
  listSettings,
  getSetting,
  listDocumentTemplates,
} from "./config";
export { listPriceLists, listTariffs, findTariffByCode } from "./tariffs";
export {
  type CreatePatientContactData,
  type CreatePatientIdentifierData,
  type CreateDuplicateCandidateData,
  createPatientContact,
  listPatientContacts,
  createPatientIdentifier,
  listPatientIdentifiers,
  findPatientIdentifier,
  createDuplicateCandidate,
  listDuplicateCandidates,
} from "./patient-identity";
export {
  type CreateObservationData,
  type CreateDiagnosisData,
  createObservation,
  listObservations,
  createDiagnosis,
  listDiagnoses,
} from "./clinical-structure";
