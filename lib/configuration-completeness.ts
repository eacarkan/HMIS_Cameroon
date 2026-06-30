/**
 * Configuration completeness (Phase 3A) — pure, client-safe readiness model for a hospital
 * INSTANCE. Given a hospital-scoped summary (counts + which setting keys are present), it
 * computes a per-category "configured / not configured" status and an overall percentage,
 * and can compare two hospitals' completeness category-by-category.
 *
 * It is data-only: a hospital is "more complete" purely because more of its own configuration
 * rows exist — never because of a code change. Bertoua (fully configured) and Ebolowa (a site
 * being prepared) therefore diverge by data alone. No patient or transaction data is involved.
 */

export type ConfigCategoryKey =
  | "hospital_identity"
  | "departments_services"
  | "outpatient_services"
  | "wards"
  | "cashier_points"
  | "pharmacy"
  | "lab_radiology"
  | "tariffs"
  | "payment_modes"
  | "cashier_shift_rules"
  | "medications"
  | "stock_batches"
  | "document_headers"
  | "document_numbering"
  | "users"
  | "roles_capabilities"
  | "super_users"
  | "language_preference"
  | "reporting_calendar"
  | "dhis2_export"
  | "backup_schedule"
  | "local_server_status";

/**
 * Hospital-scoped configuration summary. Every field is gathered by the service layer with a
 * `hospitalId` filter; `settingKeys` lists which Setting keys exist for this hospital. Pure
 * counts only — no nominative/patient data.
 */
export type HospitalConfigSummary = {
  identity: { hasName: boolean; hasCity: boolean; hasRegion: boolean; hasCode: boolean };
  departmentCount: number;
  activeServiceCount: number;
  outpatientConsultCount: number;
  wardCount: number;
  cashierServiceCount: number;
  pharmacyServiceCount: number;
  labServiceCount: number;
  imagingServiceCount: number;
  diagnosticCatalogueCount: number;
  tariffCount: number;
  medicationCount: number;
  stockBatchCount: number;
  documentTemplateCount: number;
  sequenceCount: number;
  userCount: number;
  adminUserCount: number;
  roleCount: number;
  settingKeys: readonly string[];
};

export type ConfigCategory = {
  key: ConfigCategoryKey;
  labelFr: string;
  labelEn: string;
  /** When set, the category is satisfied iff this Setting key is present for the hospital. */
  settingKey?: string;
  predicate: (s: HospitalConfigSummary) => boolean;
};

const has = (s: HospitalConfigSummary, key: string) => s.settingKeys.includes(key);

/**
 * The configuration categories tracked for site readiness (doc 32 §6 / doc 34 §4). Order is
 * the display order. Categories backed by a single setting key declare `settingKey` so the
 * apply/override flow and the dashboard agree on what "configured" means.
 */
export const CONFIG_CATEGORIES: readonly ConfigCategory[] = [
  {
    key: "hospital_identity",
    labelFr: "Identité de l'hôpital",
    labelEn: "Hospital identity",
    predicate: (s) => s.identity.hasName && s.identity.hasCity && s.identity.hasRegion && s.identity.hasCode,
  },
  {
    key: "departments_services",
    labelFr: "Départements et services",
    labelEn: "Departments & services",
    predicate: (s) => s.departmentCount >= 1 && s.activeServiceCount >= 1,
  },
  {
    key: "outpatient_services",
    labelFr: "Services de consultation externe",
    labelEn: "Outpatient services",
    predicate: (s) => s.outpatientConsultCount >= 1,
  },
  {
    key: "wards",
    labelFr: "Services d'hospitalisation",
    labelEn: "Wards",
    predicate: (s) => s.wardCount >= 1,
  },
  {
    key: "cashier_points",
    labelFr: "Points de caisse",
    labelEn: "Cashier points",
    predicate: (s) => s.cashierServiceCount >= 1,
  },
  {
    key: "pharmacy",
    labelFr: "Pharmacie",
    labelEn: "Pharmacy",
    predicate: (s) => s.pharmacyServiceCount >= 1,
  },
  {
    key: "lab_radiology",
    labelFr: "Laboratoire / imagerie",
    labelEn: "Lab / radiology",
    predicate: (s) => s.labServiceCount >= 1 || s.imagingServiceCount >= 1 || s.diagnosticCatalogueCount >= 1,
  },
  {
    key: "tariffs",
    labelFr: "Tarifs",
    labelEn: "Tariffs",
    predicate: (s) => s.tariffCount >= 1,
  },
  {
    key: "payment_modes",
    labelFr: "Modes de paiement",
    labelEn: "Payment modes",
    settingKey: "payment.modes",
    predicate: (s) => has(s, "payment.modes"),
  },
  {
    key: "cashier_shift_rules",
    labelFr: "Règles de session de caisse",
    labelEn: "Cashier shift rules",
    settingKey: "cashier.shift.rules",
    predicate: (s) => has(s, "cashier.shift.rules"),
  },
  {
    key: "medications",
    labelFr: "Médicaments",
    labelEn: "Medications",
    predicate: (s) => s.medicationCount >= 1,
  },
  {
    key: "stock_batches",
    labelFr: "Lots de stock",
    labelEn: "Stock batches",
    predicate: (s) => s.stockBatchCount >= 1,
  },
  {
    key: "document_headers",
    labelFr: "En-têtes de documents",
    labelEn: "Document headers",
    predicate: (s) => s.documentTemplateCount >= 1,
  },
  {
    key: "document_numbering",
    labelFr: "Numérotation des documents",
    labelEn: "Document numbering",
    predicate: (s) => s.sequenceCount >= 1,
  },
  {
    key: "users",
    labelFr: "Utilisateurs",
    labelEn: "Users",
    predicate: (s) => s.userCount >= 1,
  },
  {
    key: "roles_capabilities",
    labelFr: "Rôles et habilitations",
    labelEn: "Roles & capabilities",
    predicate: (s) => s.roleCount >= 1,
  },
  {
    key: "super_users",
    labelFr: "Super-utilisateurs (administrateurs)",
    labelEn: "Super users (admins)",
    predicate: (s) => s.adminUserCount >= 1,
  },
  {
    key: "language_preference",
    labelFr: "Préférence de langue",
    labelEn: "Language preference",
    settingKey: "locale.default",
    predicate: (s) => has(s, "locale.default"),
  },
  {
    key: "reporting_calendar",
    labelFr: "Calendrier de reporting",
    labelEn: "Reporting calendar",
    settingKey: "reporting.calendar",
    predicate: (s) => has(s, "reporting.calendar"),
  },
  {
    key: "dhis2_export",
    labelFr: "Paramètres d'export DHIS2 (manuel)",
    labelEn: "DHIS2 manual-export settings",
    settingKey: "dhis2.export",
    predicate: (s) => has(s, "dhis2.export"),
  },
  {
    key: "backup_schedule",
    labelFr: "Planification des sauvegardes",
    labelEn: "Backup schedule",
    settingKey: "backup.schedule",
    predicate: (s) => has(s, "backup.schedule"),
  },
  {
    key: "local_server_status",
    labelFr: "État du serveur local",
    labelEn: "Local-server status",
    settingKey: "local_server.status",
    predicate: (s) => has(s, "local_server.status"),
  },
];

export type CategoryStatus = {
  key: ConfigCategoryKey;
  labelFr: string;
  labelEn: string;
  configured: boolean;
};

export type CompletenessResult = {
  categories: CategoryStatus[];
  configuredCount: number;
  total: number;
  /** 0–100, rounded. */
  percent: number;
  ready: boolean;
};

/** Compute per-category status + overall percentage for one hospital instance. */
export function computeCompleteness(summary: HospitalConfigSummary): CompletenessResult {
  const categories = CONFIG_CATEGORIES.map((c) => ({
    key: c.key,
    labelFr: c.labelFr,
    labelEn: c.labelEn,
    configured: c.predicate(summary),
  }));
  const configuredCount = categories.filter((c) => c.configured).length;
  const total = categories.length;
  const percent = total === 0 ? 0 : Math.round((configuredCount / total) * 100);
  return { categories, configuredCount, total, percent, ready: configuredCount === total };
}

export type CompletenessComparisonRow = {
  key: ConfigCategoryKey;
  labelFr: string;
  labelEn: string;
  a: boolean;
  b: boolean;
  differ: boolean;
};

/** Compare two completeness results category-by-category (a = reference, b = candidate). */
export function compareCompleteness(
  a: CompletenessResult,
  b: CompletenessResult,
): CompletenessComparisonRow[] {
  const bByKey = new Map(b.categories.map((c) => [c.key, c.configured]));
  return a.categories.map((ca) => {
    const bConfigured = bByKey.get(ca.key) ?? false;
    return {
      key: ca.key,
      labelFr: ca.labelFr,
      labelEn: ca.labelEn,
      a: ca.configured,
      b: bConfigured,
      differ: ca.configured !== bConfigured,
    };
  });
}
