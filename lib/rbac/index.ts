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
  | "admin.manage";

const ALL: Capability[] = [
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
  administrateur: ALL,
  agent_accueil: [
    "dashboard.read",
    "patient.read",
    "patient.create",
    "encounter.read",
    "encounter.create",
  ],
  medecin: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "consultation.create",
  ],
  caissier: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "invoice.read",
    "invoice.create",
    "payment.record",
    "receipt.print",
  ],
  directeur: [
    "dashboard.read",
    "patient.read",
    "encounter.read",
    "consultation.read",
    "invoice.read",
    "audit.read",
  ],
};

/** True if any of the actor's roles grants the capability. */
export function can(roles: readonly string[], capability: Capability): boolean {
  return roles.some((role) =>
    ROLE_CAPABILITIES[role as Role]?.includes(capability),
  );
}
