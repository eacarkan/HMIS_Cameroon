/**
 * RBAC matrix (pure, client-safe) — 09 §6, 07 §4.
 *
 * Coarse roles for the prototype. The detailed permission set comes post-audit; the
 * *structure* (roles → capabilities, contextual per hospital) is fixed now. Used both
 * server-side (enforcement, server/authz + authz-service) and client-side (nav
 * filtering). No side effects, no data access.
 */

export type Role =
  "administrateur" | "agent_accueil" | "medecin" | "caissier" | "directeur";

export type Capability =
  // Phase 0 capabilities.
  | "dashboard.read"
  | "patient.read"
  | "patient.create"
  | "encounter.read"
  | "encounter.create"
  | "consultation.read"
  | "consultation.create"
  | "invoice.read"
  | "invoice.create"
  | "payment.record"
  | "receipt.print"
  | "audit.read"
  | "admin.manage"
  // Phase 1 (Gate 3) capabilities. NB: the administrator manages configuration and
  // tariffs but is NOT granted routine patient-identity or clinical access (23 §6);
  // those are reception / clinician only.
  | "config.read"
  | "config.manage"
  | "patient.identity.read"
  | "patient.identity.manage"
  | "patient.duplicate.manage"
  | "clinical.structure.read"
  | "clinical.structure.manage"
  | "tariff.read"
  | "tariff.manage"
  | "tariff.use"
  // Phase 1 (Gate 5B) capabilities.
  | "cashier.report.read"
  | "user.manage"
  // Phase 2A capabilities — service/department catalogue. `manage` = Hospital Admin (and
  // Local IT Lead when assigned); `view` = operational roles, scoped to ACTIVE services.
  | "service.config.manage"
  | "service.config.view";

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  // Hospital administrator — configuration, tariffs, users, service catalogue, and oversight
  // READS. Phase 2A applies capability-based RBAC: the admin is NOT a clinical/billing
  // superuser, so the data-entry capabilities (patient/encounter/consultation/invoice create,
  // payment.record, receipt.print) are REMOVED — entry stays with reception/clinician/cashier.
  // (This additively corrects the broad Phase 1A admin access flagged in the Phase 1A review.)
  administrateur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
    "admin.manage",
    "config.read",
    "config.manage",
    "service.config.manage",
    "service.config.view",
    "tariff.read",
    "tariff.manage",
    "cashier.report.read",
    "user.manage",
  ],
  agent_accueil: [
    "dashboard.read",
    "patient.read",
    "patient.create",
    "encounter.read",
    "encounter.create",
    "patient.identity.read",
    "patient.identity.manage",
    "patient.duplicate.manage",
    "service.config.view",
  ],
  medecin: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "consultation.create",
    "patient.identity.read",
    "clinical.structure.read",
    "clinical.structure.manage",
    "service.config.view",
  ],
  caissier: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "invoice.read",
    "invoice.create",
    "payment.record",
    "receipt.print",
    "tariff.read",
    "tariff.use",
    "cashier.report.read",
    "service.config.view",
  ],
  directeur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
    "config.read",
    "cashier.report.read",
    "service.config.view",
  ],
};

/** True if any of the actor's roles grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) =>
    ROLE_CAPABILITIES[role as Role]?.includes(capability),
  );
}
