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
export { type AuditEntryInput, createAuditEntry } from "./audit";
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
