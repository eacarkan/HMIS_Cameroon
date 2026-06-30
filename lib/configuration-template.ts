/**
 * Configuration templates (Phase 3A) — pure, client-safe helpers for the multi-hospital
 * configuration foundation. A template is a REUSABLE, HOSPITAL-AGNOSTIC blueprint: it
 * carries configuration STRUCTURE (departments, services + eligibility flags, settings,
 * document templates) but NEVER hospital identity (name/city), patient data or transactions.
 *
 * Two hospitals built from the same template still differ purely by their own instance data
 * (identity + any per-instance overrides) — "differ without a code change". This module only
 * validates/normalises content and computes an apply PLAN; the guarded, hospital-scoped write
 * lives in `server/db` and the RBAC/audit wrapper in `server/services`.
 */

/** The eight service-eligibility flags carried by a template service (mirrors the catalogue). */
export const TEMPLATE_SERVICE_FLAGS = [
  "acceptsQueue",
  "acceptsConsultation",
  "supportsBilling",
  "supportsPharmacy",
  "supportsLab",
  "supportsImaging",
  "isInpatientWard",
  "isEmergency",
] as const;

export type TemplateServiceFlag = (typeof TEMPLATE_SERVICE_FLAGS)[number];

export type TemplateDepartment = { code: string; name: string };

export type TemplateService = {
  code: string;
  nameFr: string;
  nameEn?: string | null;
  type: string;
  displayOrder?: number;
  departmentCode?: string | null;
  kind?: string | null;
} & Partial<Record<TemplateServiceFlag, boolean>>;

export type TemplateSetting = { key: string; value: string };

export type TemplateDocument = {
  type: string;
  name: string;
  header?: string | null;
  body?: string | null;
};

export type ConfigurationTemplateContent = {
  departments: TemplateDepartment[];
  services: TemplateService[];
  settings: TemplateSetting[];
  documentTemplates: TemplateDocument[];
};

export const EMPTY_TEMPLATE_CONTENT: ConfigurationTemplateContent = {
  departments: [],
  services: [],
  settings: [],
  documentTemplates: [],
};

/**
 * Setting keys that describe hospital IDENTITY and must NEVER live in a shared template —
 * they stay per-instance so two hospitals from one template remain distinguishable. Apply
 * skips these defensively even if a malformed template tries to carry them.
 */
export const PER_INSTANCE_SETTING_PREFIXES = ["hospital.", "identity."] as const;

export function isPerInstanceSettingKey(key: string): boolean {
  return PER_INSTANCE_SETTING_PREFIXES.some((p) => key.startsWith(p));
}

/** True when `value` is a non-empty trimmed string. */
function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Parse + validate an arbitrary JSON value into a well-formed template content payload.
 * Returns the normalised content (trimmed, de-duplicated keys, flags coerced to booleans)
 * or a list of human-readable French errors. Never throws.
 */
export function validateTemplateContent(
  input: unknown,
): { ok: true; content: ConfigurationTemplateContent } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input === null || typeof input !== "object") {
    return { ok: false, errors: ["Le contenu du modèle doit être un objet."] };
  }
  const raw = input as Record<string, unknown>;
  const departments: TemplateDepartment[] = [];
  const services: TemplateService[] = [];
  const settings: TemplateSetting[] = [];
  const documentTemplates: TemplateDocument[] = [];

  // --- Departments ---
  const seenDept = new Set<string>();
  for (const d of Array.isArray(raw.departments) ? raw.departments : []) {
    const dept = d as Record<string, unknown>;
    if (!nonEmpty(dept.code) || !nonEmpty(dept.name)) {
      errors.push("Chaque département du modèle doit avoir un code et un nom.");
      continue;
    }
    const code = (dept.code as string).trim();
    if (seenDept.has(code)) {
      errors.push(`Département en double dans le modèle : ${code}.`);
      continue;
    }
    seenDept.add(code);
    departments.push({ code, name: (dept.name as string).trim() });
  }

  // --- Services ---
  const seenService = new Set<string>();
  for (const s of Array.isArray(raw.services) ? raw.services : []) {
    const svc = s as Record<string, unknown>;
    if (!nonEmpty(svc.code) || !nonEmpty(svc.nameFr) || !nonEmpty(svc.type)) {
      errors.push("Chaque service du modèle doit avoir un code, un nom (FR) et un type.");
      continue;
    }
    const code = (svc.code as string).trim();
    if (seenService.has(code)) {
      errors.push(`Service en double dans le modèle : ${code}.`);
      continue;
    }
    seenService.add(code);
    const flags: Partial<Record<TemplateServiceFlag, boolean>> = {};
    for (const flag of TEMPLATE_SERVICE_FLAGS) {
      if (svc[flag] !== undefined) flags[flag] = Boolean(svc[flag]);
    }
    services.push({
      code,
      nameFr: (svc.nameFr as string).trim(),
      nameEn: nonEmpty(svc.nameEn) ? (svc.nameEn as string).trim() : null,
      type: (svc.type as string).trim(),
      displayOrder: typeof svc.displayOrder === "number" ? svc.displayOrder : 0,
      departmentCode: nonEmpty(svc.departmentCode) ? (svc.departmentCode as string).trim() : null,
      kind: nonEmpty(svc.kind) ? (svc.kind as string).trim() : null,
      ...flags,
    });
  }
  // A service may only reference a department the template itself defines.
  for (const svc of services) {
    if (svc.departmentCode && !seenDept.has(svc.departmentCode)) {
      errors.push(`Le service ${svc.code} référence un département absent du modèle : ${svc.departmentCode}.`);
    }
  }

  // --- Settings (identity keys are forbidden in a shared template) ---
  const seenSetting = new Set<string>();
  for (const st of Array.isArray(raw.settings) ? raw.settings : []) {
    const setting = st as Record<string, unknown>;
    if (!nonEmpty(setting.key) || typeof setting.value !== "string") {
      errors.push("Chaque paramètre du modèle doit avoir une clé et une valeur (texte).");
      continue;
    }
    const key = (setting.key as string).trim();
    if (isPerInstanceSettingKey(key)) {
      errors.push(`Le paramètre d'identité ${key} ne peut pas figurer dans un modèle partagé.`);
      continue;
    }
    if (seenSetting.has(key)) {
      errors.push(`Paramètre en double dans le modèle : ${key}.`);
      continue;
    }
    seenSetting.add(key);
    settings.push({ key, value: setting.value as string });
  }

  // --- Document templates ---
  const seenDoc = new Set<string>();
  for (const dt of Array.isArray(raw.documentTemplates) ? raw.documentTemplates : []) {
    const doc = dt as Record<string, unknown>;
    if (!nonEmpty(doc.type) || !nonEmpty(doc.name)) {
      errors.push("Chaque modèle de document doit avoir un type et un nom.");
      continue;
    }
    const dedupeKey = `${(doc.type as string).trim()}::${(doc.name as string).trim()}`;
    if (seenDoc.has(dedupeKey)) {
      errors.push(`Modèle de document en double : ${dedupeKey}.`);
      continue;
    }
    seenDoc.add(dedupeKey);
    documentTemplates.push({
      type: (doc.type as string).trim(),
      name: (doc.name as string).trim(),
      header: nonEmpty(doc.header) ? (doc.header as string).trim() : null,
      body: nonEmpty(doc.body) ? (doc.body as string).trim() : null,
    });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, content: { departments, services, settings, documentTemplates } };
}

/** Coerce stored JSON (already trusted) into typed content, defaulting missing arrays. */
export function asTemplateContent(value: unknown): ConfigurationTemplateContent {
  const result = validateTemplateContent(value);
  return result.ok ? result.content : { ...EMPTY_TEMPLATE_CONTENT };
}

/** Row counts per category — used for template summaries in the UI/log. */
export function summarizeTemplateContent(content: ConfigurationTemplateContent) {
  return {
    departments: content.departments.length,
    services: content.services.length,
    settings: content.settings.length,
    documentTemplates: content.documentTemplates.length,
  };
}

export type ApplyPlanAction = "create" | "update";
export type ApplyPlanItem = {
  category: "department" | "service" | "setting" | "document";
  key: string;
  action: ApplyPlanAction;
};

/** Keys (per category) that already exist in the target instance, for create-vs-update planning. */
export type ExistingInstanceKeys = {
  departmentCodes: readonly string[];
  serviceCodes: readonly string[];
  settingKeys: readonly string[];
  documentKeys: readonly string[]; // `${type}::${name}`
};

/**
 * Pure apply-plan: classify each template row as a create or an update against the target
 * instance's existing keys. Identity settings are dropped (never applied). The DB layer
 * executes the same classification inside one guarded, hospital-scoped transaction.
 */
export function planTemplateApply(
  content: ConfigurationTemplateContent,
  existing: ExistingInstanceKeys,
): { items: ApplyPlanItem[]; created: number; updated: number } {
  const items: ApplyPlanItem[] = [];
  const dept = new Set(existing.departmentCodes);
  const svc = new Set(existing.serviceCodes);
  const set = new Set(existing.settingKeys);
  const doc = new Set(existing.documentKeys);

  for (const d of content.departments) {
    items.push({ category: "department", key: d.code, action: dept.has(d.code) ? "update" : "create" });
  }
  for (const s of content.services) {
    items.push({ category: "service", key: s.code, action: svc.has(s.code) ? "update" : "create" });
  }
  for (const s of content.settings) {
    if (isPerInstanceSettingKey(s.key)) continue;
    items.push({ category: "setting", key: s.key, action: set.has(s.key) ? "update" : "create" });
  }
  for (const d of content.documentTemplates) {
    const key = `${d.type}::${d.name}`;
    items.push({ category: "document", key, action: doc.has(key) ? "update" : "create" });
  }

  const created = items.filter((i) => i.action === "create").length;
  const updated = items.filter((i) => i.action === "update").length;
  return { items, created, updated };
}
