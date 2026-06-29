import {
  APP_VERSION,
  DATA_MODE,
  DATA_MODE_LABEL,
  REAL_DATA_ENABLED,
  type DataMode,
} from "@/lib/data-mode";
import { validateEnv, type EnvValidation } from "@/lib/env-validation";
import { pingDatabase } from "@/server/db";

/**
 * System service (infrastructure, not a domain feature).
 *
 * Demonstrates the canonical flow — service orchestrates a use-case and calls the
 * hospital-scoped data-access layer; it never touches Prisma itself (09 §4). Domain
 * services (patients, encounters, billing, …) follow this shape from Step 3+, adding
 * authorization + hospital scoping + audit before they touch data.
 */
export async function getDatabaseStatus(): Promise<{
  connected: boolean;
  serverTime: Date | null;
}> {
  try {
    const { ok, now } = await pingDatabase();
    return { connected: ok, serverTime: now };
  } catch {
    return { connected: false, serverTime: null };
  }
}

export type SystemStatus = {
  appVersion: string;
  db: { connected: boolean; serverTime: Date | null };
  dataMode: DataMode;
  dataModeLabel: string;
  realDataEnabled: boolean;
  env: EnvValidation;
  /** App-level pilot-readiness signals (real backup infra is a supplier concern). */
  readiness: { label: string; ok: boolean }[];
};

/**
 * Pilot-readiness status (Phase 1A Batch 6). Reports REAL signals — DB reachability, app
 * version, data mode, env validation — so the health/status page does not create false
 * confidence. Backup/restore here is an app-level readiness *hook* only: actual backup
 * infrastructure is a specialized-supplier concern and is intentionally not implemented.
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const db = await getDatabaseStatus();
  const env = validateEnv(process.env);
  const readiness = [
    { label: "Base de données joignable", ok: db.connected },
    { label: "Configuration d'environnement valide", ok: env.ok },
    { label: "Données fictives uniquement (chemin données réelles désactivé)", ok: !REAL_DATA_ENABLED },
    {
      label: "Sauvegarde/restauration : infrastructure fournisseur (hors application)",
      ok: false,
    },
  ];
  return {
    appVersion: APP_VERSION,
    db,
    dataMode: DATA_MODE,
    dataModeLabel: DATA_MODE_LABEL,
    realDataEnabled: REAL_DATA_ENABLED,
    env,
    readiness,
  };
}
