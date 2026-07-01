/**
 * Phase 4F — advanced reporting / analytics foundation (PURE, no I/O). Report-definition validation,
 * the aggregate row model, the report-kind → aggregate-rows transform, and the aggregate-only guard.
 *
 * PRIVACY: an analytics report is AGGREGATE-ONLY. A result row may carry only the whitelisted aggregate
 * keys (section / dimension / subDimension / label / value) — never a patient identifier. The transform
 * consumes the already-aggregate Phase 2E operational report (which carries no nominative field) and the
 * guard rejects any row with a non-whitelisted key. No AI/ML; no patient-level data.
 */

export type ReportKindCode = "OPERATIONAL_SUMMARY" | "REVENUE_BY_METHOD" | "TOP_DIAGNOSES" | "AGE_GENDER";
export type ReportTriggerCode = "ON_DEMAND" | "SCHEDULED_PLACEHOLDER";
export type ReportExportFormatCode = "CSV" | "JSON";

export const REPORT_KINDS: readonly ReportKindCode[] = [
  "OPERATIONAL_SUMMARY",
  "REVENUE_BY_METHOD",
  "TOP_DIAGNOSES",
  "AGE_GENDER",
] as const;

export const REPORT_TRIGGERS: readonly ReportTriggerCode[] = ["ON_DEMAND", "SCHEDULED_PLACEHOLDER"] as const;
export const REPORT_EXPORT_FORMATS: readonly ReportExportFormatCode[] = ["CSV", "JSON"] as const;

/** One aggregate result row. Dimensions are aggregate labels ONLY (method / age band / gender / ICD-10). */
export type AggregateRow = {
  section: string;
  dimension?: string;
  subDimension?: string;
  label?: string;
  value: number;
};

/** The ONLY keys an aggregate analytics row may carry. Any other key is rejected as non-aggregate. */
export const AGGREGATE_ROW_KEYS = new Set<string>(["section", "dimension", "subDimension", "label", "value"]);

/** The aggregate slice of the Phase 2E operational report that 4F consumes (no nominative field). */
export type OperationalReportAggregate = {
  consultationCount: number;
  diagnosisCount: number;
  revenueTotal: number;
  revenueByMethod: { method: string; amount: number }[];
  ageGender: { band: string; M: number; F: number; U: number; total: number }[];
  diagnoses: { code: string; label: string; count: number }[];
};

type Result = { ok: true } | { ok: false; error: string };

export type ReportDefinitionInput = {
  code: string;
  name: string;
  kind: string;
  description?: string | null;
  topN?: number | null;
  schedulePlaceholder?: string | null;
};

export function isReportKind(kind: string): kind is ReportKindCode {
  return (REPORT_KINDS as readonly string[]).includes(kind);
}

export function validateReportDefinitionInput(input: ReportDefinitionInput): Result {
  if (!input.code?.trim()) return { ok: false, error: "Le code du rapport est obligatoire." };
  if (input.code.trim().toUpperCase() !== input.code.trim()) {
    return { ok: false, error: "Le code doit être en MAJUSCULES (identifiant stable)." };
  }
  if (!input.name?.trim()) return { ok: false, error: "Le nom du rapport est obligatoire." };
  if (!isReportKind(input.kind)) return { ok: false, error: "Type de rapport inconnu." };
  if (input.topN != null && (!Number.isInteger(input.topN) || input.topN < 1 || input.topN > 50)) {
    return { ok: false, error: "Le paramètre « top N » doit être un entier entre 1 et 50." };
  }
  return { ok: true };
}

/** Clamp a requested top-N to the supported 1..50 window (default 10). */
export function resolveTopN(topN: number | null | undefined): number {
  if (topN == null || !Number.isFinite(topN)) return 10;
  return Math.min(50, Math.max(1, Math.trunc(topN)));
}

/**
 * Transform the aggregate operational report into the definition's aggregate rows. Every row carries
 * only the whitelisted aggregate keys — no patient identifier can be produced here.
 */
export function buildAnalyticsRows(
  kind: ReportKindCode,
  report: OperationalReportAggregate,
  params: { topN?: number | null } = {},
): AggregateRow[] {
  const topN = resolveTopN(params.topN);
  const summary: AggregateRow[] = [
    { section: "summary", label: "consultations", value: report.consultationCount },
    { section: "summary", label: "diagnoses", value: report.diagnosisCount },
    { section: "summary", label: "revenueTotal", value: report.revenueTotal },
  ];
  const revenue: AggregateRow[] = [
    { section: "revenue", label: "total", value: report.revenueTotal },
    ...report.revenueByMethod.map((r) => ({ section: "revenue", dimension: r.method, value: r.amount })),
  ];
  const ageGender: AggregateRow[] = report.ageGender.flatMap((r) => [
    { section: "age_gender", dimension: r.band, subDimension: "M", value: r.M },
    { section: "age_gender", dimension: r.band, subDimension: "F", value: r.F },
    { section: "age_gender", dimension: r.band, subDimension: "U", value: r.U },
  ]);
  const diagnoses: AggregateRow[] = report.diagnoses
    .slice(0, topN)
    .map((d) => ({ section: "diagnosis", dimension: d.code || "—", label: d.label, value: d.count }));

  switch (kind) {
    case "OPERATIONAL_SUMMARY":
      return [...summary, ...revenue.slice(1), ...ageGender, ...diagnoses];
    case "REVENUE_BY_METHOD":
      return revenue;
    case "TOP_DIAGNOSES":
      return diagnoses;
    case "AGE_GENDER":
      return ageGender;
  }
}

export const ANALYTICS_CSV_HEADER = ["section", "dimension", "subDimension", "label", "value"] as const;

/** Serialise aggregate rows to CSV (aggregate columns only — no patient field can appear). */
export function analyticsRowsToCsv(rows: AggregateRow[]): string {
  const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [ANALYTICS_CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push([r.section, r.dimension ?? "", r.subDimension ?? "", r.label ?? "", String(r.value)].map(esc).join(","));
  }
  return lines.join("\r\n");
}

/**
 * The aggregate-only guard — the LAST gate before any row is stored or exported. Rejects a row that
 * carries a non-whitelisted key (e.g. a leaked patient identifier) or a non-numeric value.
 */
export function assertAggregateReportRows(rows: Record<string, unknown>[]): Result {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!AGGREGATE_ROW_KEYS.has(key)) {
        return { ok: false, error: `Champ non agrégé « ${key} » interdit dans un rapport analytique.` };
      }
    }
    if (typeof row.value !== "number" || !Number.isFinite(row.value)) {
      return { ok: false, error: "Chaque ligne agrégée doit porter une valeur numérique." };
    }
  }
  return { ok: true };
}
