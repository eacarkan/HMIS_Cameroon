/**
 * Deployment & public-access mode flags (Phase 6 — SantéGrid web-deployment preparation).
 *
 * These control the PUBLIC (unauthenticated) stakeholder-demo surface — the marketing
 * landing, the feature showcase, and the flag-gated one-click demo login — separately
 * from the internal synthetic-data mode in `lib/data-mode.ts`.
 *
 * Every flag FAILS CLOSED: unset or unexpected values are treated as OFF / "local".
 * Pure functions take the env as an argument so they are unit-testable; the module-level
 * constants read `process.env` once at import for convenient server-side use.
 *
 * Boundary: this is a synthetic stakeholder-demo surface only — not production, not Gate 7,
 * not real data. Enabling the public site or one-click demo login does NOT change data-mode,
 * RBAC, hospital scoping, or the F-01/F-02 hardening.
 */

type Env = Record<string, string | undefined>;

/** The deployment environment this instance runs in. Only the stakeholder-demo value unlocks demo features. */
export type DeploymentEnvironment = "local" | "stakeholder-demo";

/**
 * Resolve the deployment environment. Fails closed: only the exact string
 * "stakeholder-demo" is honored; everything else (including "production") → "local".
 */
export function resolveDeploymentEnvironment(
  value: string | undefined,
): DeploymentEnvironment {
  return value === "stakeholder-demo" ? "stakeholder-demo" : "local";
}

/** Whether this instance is the controlled stakeholder-demo deployment. */
export function isStakeholderDemo(env: Env = process.env): boolean {
  return resolveDeploymentEnvironment(env["HMIS_ENVIRONMENT"]) === "stakeholder-demo";
}

/**
 * Whether the public (unauthenticated) marketing/showcase site is enabled.
 * Fails closed: only the exact string "true" enables it.
 */
export function isPublicSiteEnabled(env: Env = process.env): boolean {
  return env["HMIS_PUBLIC_SITE_ENABLED"] === "true";
}

/**
 * Whether flag-gated one-click demo login is enabled. Fails closed: only the exact
 * string "true" enables it. `.env.example` keeps this `false`; the deployment runbook
 * may instruct the operator to set it `true` for the controlled stakeholder-demo
 * deployment only.
 */
export function isPublicDemoLoginEnabled(env: Env = process.env): boolean {
  return env["HMIS_PUBLIC_DEMO_LOGIN_ENABLED"] === "true";
}

/**
 * THE one-click demo-login gate (Phase 6C). One-click login may start a synthetic demo
 * session ONLY when BOTH hold: the instance is the stakeholder-demo deployment AND the
 * one-click flag is explicitly enabled. Outside stakeholder-demo mode (e.g. local/dev,
 * tests, or any other environment) one-click is refused even if the flag is set.
 */
export function canStartOneClickDemo(env: Env = process.env): boolean {
  return isStakeholderDemo(env) && isPublicDemoLoginEnabled(env);
}

/** The resolved deployment environment for this process. */
export const DEPLOYMENT_ENVIRONMENT: DeploymentEnvironment =
  resolveDeploymentEnvironment(process.env.HMIS_ENVIRONMENT);

/** Whether the public site is enabled for this process. */
export const PUBLIC_SITE_ENABLED: boolean = isPublicSiteEnabled();
