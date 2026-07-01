/**
 * Demo-access directory + one-click role allow-list (Phase 6C). Pure, client-safe data:
 * the synthetic seeded demo accounts (all `@hrb-demo.cm`) shown on the public demo-access
 * page, and the SELECTED subset eligible for flag-gated one-click login.
 *
 * SECURITY: this file holds NO passwords. The shared synthetic demo password is never
 * hard-coded here; it is displayed from an operator-provided env hint (or a placeholder)
 * and used only server-side by the credentials sign-in. One-click login is additionally
 * gated by `canStartOneClickDemo()` (stakeholder-demo mode + flag) — see server/auth.
 *
 * Sensitive roles (director, diagnostic validator) and the reception / pharmacist-chief
 * accounts remain CREDENTIAL-ONLY (not one-click), per Doc 42 §5.
 */

/** A demo account shown in the public directory. All synthetic (`@hrb-demo.cm`). */
export type DemoDirectoryEntry = {
  /** Stable key for the i18n role label (`demoAccess.roles.<key>`). */
  key: string;
  /** Synthetic seeded email (@hrb-demo.cm). */
  email: string;
  /** RBAC role code. */
  roleCode: string;
  /** Demo hospital code. */
  hospitalCode: string;
  /** Whether this account is eligible for one-click login. */
  oneClick: boolean;
};

/** A selected one-click demo role (button). */
export type OneClickDemoRole = {
  key: string;
  email: string;
  roleCode: string;
};

/** The full public directory — the ten synthetic seeded demo accounts. */
export const DEMO_DIRECTORY: readonly DemoDirectoryEntry[] = [
  { key: "central_supervisor", email: "direction.regionale@hrb-demo.cm", roleCode: "superviseur_central", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "admin", email: "awa.njoya@hrb-demo.cm", roleCode: "administrateur", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "doctor", email: "jeanpaul.etoa@hrb-demo.cm", roleCode: "medecin", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "cashier", email: "solange.abena@hrb-demo.cm", roleCode: "caissier", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "pharmacist", email: "georges.mballa@hrb-demo.cm", roleCode: "pharmacien", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "lab_tech", email: "paul.ngono@hrb-demo.cm", roleCode: "technicien_diagnostic", hospitalCode: "HRB-DEMO", oneClick: true },
  { key: "reception", email: "brigitte.mbarga@hrb-demo.cm", roleCode: "agent_accueil", hospitalCode: "HRB-DEMO", oneClick: false },
  { key: "pharmacist_chief", email: "claire.fotso@hrb-demo.cm", roleCode: "pharmacien_chef", hospitalCode: "HRB-DEMO", oneClick: false },
  { key: "director", email: "emmanuel.tchoua@hrb-demo.cm", roleCode: "directeur", hospitalCode: "HRB-DEMO", oneClick: false },
  { key: "validator", email: "marie.eyenga@hrb-demo.cm", roleCode: "validateur_diagnostic", hospitalCode: "HRB-DEMO", oneClick: false },
] as const;

/**
 * The SELECTED one-click demo roles (Doc 42 §5 / Doc 43 §7). Seven role buttons:
 * central supervisor, admin, doctor, cashier, pharmacist, lab technician, radiology
 * technician. Lab and radiology share the seeded `technicien_diagnostic` account
 * (the seeded role does not distinguish modality — a future refinement).
 */
export const ONE_CLICK_DEMO_ROLES: readonly OneClickDemoRole[] = [
  { key: "central_supervisor", email: "direction.regionale@hrb-demo.cm", roleCode: "superviseur_central" },
  { key: "admin", email: "awa.njoya@hrb-demo.cm", roleCode: "administrateur" },
  { key: "doctor", email: "jeanpaul.etoa@hrb-demo.cm", roleCode: "medecin" },
  { key: "cashier", email: "solange.abena@hrb-demo.cm", roleCode: "caissier" },
  { key: "pharmacist", email: "georges.mballa@hrb-demo.cm", roleCode: "pharmacien" },
  { key: "lab_tech", email: "paul.ngono@hrb-demo.cm", roleCode: "technicien_diagnostic" },
  { key: "radiology_tech", email: "paul.ngono@hrb-demo.cm", roleCode: "technicien_diagnostic" },
] as const;

/**
 * Resolve a one-click role key to its synthetic account, or null if the key is not in
 * the selected allow-list (e.g. a sensitive credential-only role). Server-side callers
 * MUST use this so a forged key can never one-click into a non-selected account.
 */
export function resolveOneClickDemoRole(key: string): OneClickDemoRole | null {
  return ONE_CLICK_DEMO_ROLES.find((r) => r.key === key) ?? null;
}
