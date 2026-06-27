/**
 * `server/db` — the hospital-scoped data-access layer.
 *
 * Responsibility (09 §2): the ONLY place Prisma is called. Every domain function
 * added here from Step 3+ takes a `HospitalContext` and filters by it. Consumers
 * are `server/services` — never the UI, components, features, or pages (enforced by
 * ESLint `no-restricted-imports`).
 */
export { prisma } from "./prisma";
export {
  type HospitalContext,
  PLACEHOLDER_HOSPITAL_CONTEXT,
  requireHospitalContext,
} from "./hospital-context";
export { pingDatabase } from "./health";
