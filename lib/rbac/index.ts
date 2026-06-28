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
  | "tariff.use";

/** All Phase 0 capabilities (the administrator's Phase 0 baseline). */
const PHASE0_ALL: Capability[] = [
  "dashboard.read",
  "patient.read",
  "patient.create",
  "encounter.read",
  "encounter.create",
  "consultation.read",
  "consultation.create",
  "invoice.read",
  "invoice.create",
  "payment.record",
  "receipt.print",
  "audit.read",
  "admin.manage",
];

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  // Admin manages configuration + tariffs; clinical/identity stay role-specific (23 §6).
  administrateur: [
    ...PHASE0_ALL,
    "config.read",
    "config.manage",
    "tariff.read",
    "tariff.manage",
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
  ],
  directeur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
    "config.read",
  ],
};

/** True if any of the actor's roles grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) =>
    ROLE_CAPABILITIES[role as Role]?.includes(capability),
  );
}
