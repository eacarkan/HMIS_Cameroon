/**
 * Local-server / Gate-7 readiness — pure, client-safe descriptors (Phase 2J).
 *
 * A STATUS-ONLY view: what the software itself carries (bilingual UI, health/status page, backup EXPORT
 * HOOK as a placeholder) vs. what is an ADMINISTRATIVE / infrastructure prerequisite the software cannot
 * self-authorize (signed UAT, validated hardware, baseline cybersecurity assessment, encryption key
 * management). No hard-coded backup/CETIC URLs; no real export is performed here.
 */

export type ReadinessStatus =
  | "ready" // delivered by the software in this prototype
  | "placeholder" // a hook/interface exists; the target is infrastructure config (not set here)
  | "administrative"; // not something software can self-authorize (process / infra responsibility)

export type ReadinessItem = { key: string; status: ReadinessStatus };

/**
 * The Gate-7 readiness checklist. The software can mark items `ready`/`placeholder`; it must NEVER
 * mark an `administrative` item as satisfied — Gate 7 authorization is a MINSANTE/infra process.
 */
export const GATE7_READINESS: ReadinessItem[] = [
  { key: "bilingual", status: "ready" },
  { key: "healthStatusPage", status: "ready" },
  { key: "auditTrail", status: "ready" },
  { key: "syntheticDataOnly", status: "ready" },
  { key: "backupExportHook", status: "placeholder" },
  { key: "localServerConfig", status: "placeholder" },
  { key: "encryptionBeforeLeavingServer", status: "administrative" },
  { key: "signedUat", status: "administrative" },
  { key: "validatedHardware", status: "administrative" },
  { key: "baselineCybersecurity", status: "administrative" },
];

/** Backup export-hook status. INERT placeholder — no target URL is configured in the software. */
export type BackupStatus = {
  configured: false;
  targetConfigured: false;
  encryptionResponsibility: "infrastructure";
};

export function getBackupStatus(): BackupStatus {
  return { configured: false, targetConfigured: false, encryptionResponsibility: "infrastructure" };
}

/** True only when EVERY non-administrative item is satisfied (ready/placeholder). Administrative items
 *  are intentionally excluded — the software can never assert Gate 7 authorization. */
export function isSoftwareReadinessComplete(items: ReadinessItem[] = GATE7_READINESS): boolean {
  return items.filter((i) => i.status !== "administrative").every((i) => i.status === "ready" || i.status === "placeholder");
}

/** The administrative prerequisites the software explicitly does NOT self-authorize. */
export function administrativePrerequisites(items: ReadinessItem[] = GATE7_READINESS): ReadinessItem[] {
  return items.filter((i) => i.status === "administrative");
}
