/**
 * `server/authz` — authorization (RBAC) boundary (09 §6).
 *
 * Auth.js answers "who is this?"; THIS layer answers "may this actor do this, here?".
 * Every protected use-case in `server/services` will check actor + role + active
 * hospital before acting; a refused action fails server-side with a clear, non-leaking
 * error and is written to the audit log as `authz.denied`. Hiding a button in the UI
 * is never the control (09 §4, §13).
 *
 * FOUNDATIONS (Steps 1-2): no roles, no permissions, no enforcement yet — the auth
 * shell arrives at Step 4 and the hospital-scoped role checks at Step 5. The coarse
 * role list below is a placeholder shape only (matches 07_Demo_Scenario users).
 */

export type Role =
  "administrateur" | "agent_accueil" | "medecin" | "caissier" | "directeur";

/** Placeholder until the service-layer RBAC lands (Step 4-5). */
export function requirePermission(action: string): never {
  throw new Error(
    `Authorization is not wired yet (arrives at build Step 4-5). Refused: ${action}`,
  );
}
