/**
 * Role workspace profiles (Phase 6.3 S4.2B — pure, client-safe, no data access).
 *
 * The mentor rule: for non-admin operational roles, the first screen must answer
 * "what work should this user handle now?", not "how many patients did the hospital
 * register today?". This module ONLY decides which composition the dashboard uses —
 * every figure behind it stays capability-gated in the service layer, so a profile
 * can never reveal a number its role may not read.
 */
export type WorkspaceProfile =
  | "admin" // hospital command center (accepted S4.2 layout)
  | "clinical" // doctor — clinical work queue
  | "cashier" // billing / collections work queue
  | "pharmacy" // prescriptions / dispensing / stock risk
  | "diagnostics" // lab & imaging work queue
  | "central" // regional supervisor — aggregate oversight only, NO hospital operational figures
  | "operations"; // reception & other operational roles — registration IS their work

/** Highest-priority profile wins when a user holds several roles at the hospital. */
const PROFILE_BY_ROLE: Record<string, WorkspaceProfile> = {
  administrateur: "admin",
  directeur: "admin",
  // The regional supervisor is AGGREGATE-ONLY (only dashboard.read + central.aggregate.view);
  // it must NOT get the operational command-center hero — its home is /central.
  superviseur_central: "central",
  medecin: "clinical",
  caissier: "cashier",
  pharmacien: "pharmacy",
  pharmacien_chef: "pharmacy",
  technicien_diagnostic: "diagnostics",
  validateur_diagnostic: "diagnostics",
  agent_accueil: "operations",
};

// A user who is BOTH an operational role AND central supervisor gets the operational
// profile (they legitimately have those capabilities) — so "central" sits low.
const PRIORITY: WorkspaceProfile[] = [
  "admin",
  "clinical",
  "cashier",
  "pharmacy",
  "diagnostics",
  "central",
  "operations",
];

export function resolveWorkspaceProfile(roles: readonly string[]): WorkspaceProfile {
  const held = new Set(roles.map((r) => PROFILE_BY_ROLE[r]).filter(Boolean));
  return PRIORITY.find((p) => held.has(p)) ?? "operations";
}
