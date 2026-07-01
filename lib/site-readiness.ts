/**
 * Site readiness & deployment checklist (Phase 3C) — pure, client-safe. STATUS TRACKING ONLY:
 * the software team performs no hardware/LAN/UPS/cybersecurity work, so those supplier-dependent
 * items can NEVER be self-claimed `ready` — they require a verifier + evidence note (otherwise the
 * appropriate status is `needs_validation`). No data access, no side effects.
 */

export const READINESS_STATUSES = [
  "not_started",
  "in_progress",
  "ready",
  "blocked",
  "not_applicable",
  "needs_validation",
] as const;

export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export type ReadinessCategory = {
  key: string;
  labelFr: string;
  labelEn: string;
  /** Supplier/infrastructure-dependent: the software team cannot self-attest `ready`. */
  supplierDependent: boolean;
};

/** The readiness checklist categories (doc 34 §6.4). Order is the display order. */
export const READINESS_CATEGORIES: readonly ReadinessCategory[] = [
  { key: "local_server", labelFr: "Serveur local", labelEn: "Local server", supplierDependent: false },
  { key: "environment_config", labelFr: "Configuration de l'environnement", labelEn: "Environment configuration", supplierDependent: false },
  { key: "db_migration", labelFr: "Migration de la base de données", labelEn: "Database migration", supplierDependent: false },
  { key: "seed_config_completeness", labelFr: "Complétude configuration / données de base", labelEn: "Seed/config completeness", supplierDependent: false },
  { key: "hardware", labelFr: "Matériel (postes, serveur)", labelEn: "Hardware", supplierDependent: true },
  { key: "lan", labelFr: "Réseau local (LAN)", labelEn: "LAN", supplierDependent: true },
  { key: "ups", labelFr: "Onduleur / alimentation (UPS)", labelEn: "UPS / power", supplierDependent: true },
  { key: "backup", labelFr: "Sauvegardes", labelEn: "Backup", supplierDependent: false },
  { key: "restore_test", labelFr: "Test de restauration", labelEn: "Restore test", supplierDependent: false },
  { key: "training", labelFr: "Formation du personnel", labelEn: "Staff training", supplierDependent: false },
  { key: "super_user", labelFr: "Super-utilisateur(s) désigné(s)", labelEn: "Super user(s)", supplierDependent: false },
  { key: "uat", labelFr: "Recette utilisateur (UAT)", labelEn: "User acceptance testing", supplierDependent: false },
  { key: "incident_fallback", labelFr: "Procédure d'incident / repli", labelEn: "Incident / fallback procedure", supplierDependent: false },
  { key: "cybersecurity", labelFr: "Évaluation cybersécurité", labelEn: "Cybersecurity assessment", supplierDependent: true },
  { key: "gate7_evidence", labelFr: "Preuves de préparation Gate 7", labelEn: "Gate 7 readiness evidence", supplierDependent: false },
];

const CATEGORY_BY_KEY = new Map(READINESS_CATEGORIES.map((c) => [c.key, c]));

export function isReadinessCategory(key: string): boolean {
  return CATEGORY_BY_KEY.has(key);
}

export function isSupplierDependent(categoryKey: string): boolean {
  return CATEGORY_BY_KEY.get(categoryKey)?.supplierDependent ?? false;
}

export type ReadinessUpdate = {
  status: ReadinessStatus;
  owner?: string | null;
  evidenceNote?: string | null;
  verifier?: string | null;
};

/**
 * Validate a readiness update. Enforces the core rule: a SUPPLIER-DEPENDENT item cannot be set
 * `ready` unless it carries BOTH a verifier and an evidence note (the supplier/independent
 * confirmation) — otherwise the honest status is `needs_validation`. French messages.
 */
export function validateReadinessUpdate(
  categoryKey: string,
  update: ReadinessUpdate,
): { ok: true } | { ok: false; error: string } {
  if (!isReadinessCategory(categoryKey)) {
    return { ok: false, error: "Catégorie de préparation inconnue." };
  }
  if (!READINESS_STATUSES.includes(update.status)) {
    return { ok: false, error: "Statut de préparation invalide." };
  }
  if (update.status === "ready" && isSupplierDependent(categoryKey)) {
    const hasVerifier = Boolean(update.verifier && update.verifier.trim());
    const hasEvidence = Boolean(update.evidenceNote && update.evidenceNote.trim());
    if (!hasVerifier || !hasEvidence) {
      return {
        ok: false,
        error:
          "Cet élément dépend d'un fournisseur : il ne peut pas être déclaré « prêt » sans vérificateur et preuve. Utilisez « à valider ».",
      };
    }
  }
  return { ok: true };
}

export type ReadinessItemView = {
  key: string;
  labelFr: string;
  labelEn: string;
  supplierDependent: boolean;
  status: ReadinessStatus;
  owner: string | null;
  evidenceNote: string | null;
  verifier: string | null;
};

export type ReadinessSummary = {
  total: number;
  applicable: number;
  ready: number;
  blocked: number;
  /** 0–100 over applicable (non-`not_applicable`) items. */
  percentReady: number;
  /** All applicable items are `ready`. */
  siteReady: boolean;
};

/** Roll up a checklist: percentage ready over applicable items + an overall site-ready flag. */
export function summarizeReadiness(items: readonly { status: ReadinessStatus }[]): ReadinessSummary {
  const total = items.length;
  const applicableItems = items.filter((i) => i.status !== "not_applicable");
  const applicable = applicableItems.length;
  const ready = applicableItems.filter((i) => i.status === "ready").length;
  const blocked = items.filter((i) => i.status === "blocked").length;
  const percentReady = applicable === 0 ? 0 : Math.round((ready / applicable) * 100);
  return { total, applicable, ready, blocked, percentReady, siteReady: applicable > 0 && ready === applicable };
}
