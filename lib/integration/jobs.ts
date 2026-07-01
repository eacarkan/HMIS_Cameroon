/**
 * Phase 4A — pure helpers for the integration registry + job framework (no I/O, no server imports).
 * Validation, the job status machine, idempotency-key derivation, and the credential-reference guard
 * that keeps SECRETS out of the database.
 */

export type IntegrationEnv = "MOCK" | "SANDBOX" | "PRODUCTION_DISABLED";
export type SystemStatus = "ACTIVE" | "INACTIVE" | "NEEDS_CONFIGURATION";
export type JobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export const INTEGRATION_ENVIRONMENTS: readonly IntegrationEnv[] = [
  "MOCK",
  "SANDBOX",
  "PRODUCTION_DISABLED",
];
export const SYSTEM_STATUSES: readonly SystemStatus[] = ["ACTIVE", "INACTIVE", "NEEDS_CONFIGURATION"];

export type Ok = { ok: true };
export type Err = { ok: false; error: string };
export type Result = Ok | Err;

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

/** Registry input: a stable UPPER-SNAKE code + a name + a free-form kind. */
export function validateExternalSystemInput(input: {
  code: string;
  name: string;
  kind: string;
}): Result {
  const code = input.code?.trim() ?? "";
  if (!CODE_RE.test(code)) {
    return {
      ok: false,
      error: "Le code du système doit être en MAJUSCULES (lettres/chiffres/_/-), 2 à 40 caractères.",
    };
  }
  if (!input.name?.trim()) return { ok: false, error: "Le nom du système est obligatoire." };
  if (!input.kind?.trim()) return { ok: false, error: "Le type du système est obligatoire." };
  return { ok: true };
}

export function isIntegrationEnv(value: string): value is IntegrationEnv {
  return (INTEGRATION_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Connector config: a name + an environment that is one of the three allowed (never a live prod). */
export function validateConnectorInput(input: { name: string; environment: string }): Result {
  if (!input.name?.trim()) return { ok: false, error: "Le nom du connecteur est obligatoire." };
  if (!isIntegrationEnv(input.environment)) {
    return {
      ok: false,
      error: "Environnement invalide (MOCK, SANDBOX ou PRODUCTION_DISABLED uniquement).",
    };
  }
  return { ok: true };
}

/**
 * Heuristic SECRET detector. A credential REFERENCE must point at a secret (an env-var name, a vault
 * path, a description) — never BE one. This rejects values that look like actual secrets so a real
 * token can never be stored in the DB. Conservative: false positives are fine (operator picks a
 * reference name instead).
 */
export function looksLikeSecret(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;
  // Known secret prefixes / PEM blocks / bearer tokens.
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(v)) return true;
  if (/\b(sk_live_|sk_test_|rk_live_|AKIA|ghp_|xox[baprs]-|AIza)[A-Za-z0-9_-]{8,}/.test(v)) return true;
  if (/^Bearer\s+\S+/i.test(v)) return true;
  // A long, high-entropy-looking opaque token (mixed case + digits, no spaces) is treated as a secret.
  if (v.length >= 24 && !/\s/.test(v) && /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v)) {
    return true;
  }
  return false;
}

export const CREDENTIAL_REFERENCE_KINDS = ["ENV_VAR", "VAULT_PATH", "DESCRIPTION"] as const;
export type CredentialReferenceKind = (typeof CREDENTIAL_REFERENCE_KINDS)[number];

/**
 * Validate a credential REFERENCE (never a secret). The `referenceValue` must be a pointer:
 * an env-var NAME, a vault path, or a description — and must NOT look like an actual secret.
 */
export function validateCredentialReference(input: {
  name: string;
  referenceKind: string;
  referenceValue: string;
}): Result {
  if (!input.name?.trim()) return { ok: false, error: "Le nom de la référence est obligatoire." };
  if (!(CREDENTIAL_REFERENCE_KINDS as readonly string[]).includes(input.referenceKind)) {
    return { ok: false, error: "Type de référence invalide (ENV_VAR, VAULT_PATH ou DESCRIPTION)." };
  }
  const ref = input.referenceValue?.trim() ?? "";
  if (!ref) return { ok: false, error: "La référence (nom de variable / chemin) est obligatoire." };
  if (looksLikeSecret(ref)) {
    return {
      ok: false,
      error:
        "Cette valeur ressemble à un secret réel. Enregistrez UNE RÉFÉRENCE (nom de variable d'environnement / chemin de coffre), jamais le secret lui-même.",
    };
  }
  if (input.referenceKind === "ENV_VAR" && !/^[A-Z][A-Z0-9_]{1,63}$/.test(ref)) {
    return {
      ok: false,
      error: "Une référence ENV_VAR doit être un NOM de variable (MAJUSCULES_AVEC_UNDERSCORES).",
    };
  }
  return { ok: true };
}

// ---- Job status machine ----

/** A job can be (re)claimed for a run only from PENDING or a non-exhausted FAILED. */
export function canClaimJob(status: JobStatus, attempts: number, maxAttempts: number): boolean {
  if (status === "PENDING") return true;
  if (status === "FAILED") return attempts < maxAttempts;
  return false;
}

/** Retry is the explicit re-run of a FAILED job that still has attempts left. */
export function canRetryJob(status: JobStatus, attempts: number, maxAttempts: number): boolean {
  return status === "FAILED" && attempts < maxAttempts;
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === "SUCCEEDED" || status === "CANCELLED";
}

/** Deterministic idempotency key for a job (so a repeated request maps to the same job row). */
export function buildJobIdempotencyKey(parts: {
  externalSystemId: string;
  kind: string;
  ref: string;
}): string {
  return `${parts.externalSystemId}:${parts.kind}:${parts.ref}`.slice(0, 191);
}
