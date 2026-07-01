# Phase 4F — Advanced Reporting and Analytics Foundation

**Batch:** 4F · **Branch:** `feature/phase4f-analytics` (stacked on 4E) · **Commit message:** `Phase 4F: add advanced reporting and analytics foundation`

> **Synthetic data only · NOT Gate 7 · AGGREGATE-ONLY · no AI/ML · no patient-level central disclosure · no production.** Doc 39 §3 (4F), §5, §8, Prompt 4F; builds on Phase 2E aggregate operational reporting.

## 1. Objective
A **configurable report-definition + run + export-registry** analytics foundation. A **`ReportDefinition`** registry (saved, parameterised aggregate reports), a **`ReportRun`** (on-demand / scheduled-PLACEHOLDER) producing **aggregate** output, and a **`ReportRunExport`** registry. **Aggregate-only; no AI/ML; no patient-level data.**

## 2. Schema (additive — §7 model decision, logged)
Migration `20260701050000_phase4f_analytics` (additive; no existing-table change; Hospital back-relations only):
- **`ReportDefinition`** (`@@unique[hospitalId, code]`) — code, name, `kind` (enum), `paramsJson` (aggregate params, e.g. `{topN}`), `schedulePlaceholder` (documentary cron, **never executed**), `isActive`.
- **`ReportRun`** (→ Definition cascade) — periodLabel/start/end, `trigger` (ON_DEMAND / SCHEDULED_PLACEHOLDER), `status` (PENDING/COMPLETED/FAILED), `rowCount`, `resultJson` (aggregate rows), `errorMessage`.
- **`ReportRunExport`** (→ Run cascade) — export registry rows (`format` CSV/JSON, rowCount, who).
- Enums: `ReportKind` (OPERATIONAL_SUMMARY / REVENUE_BY_METHOD / TOP_DIAGNOSES / AGE_GENDER), `ReportRunTrigger`, `ReportRunStatus`, `ReportExportFormat`.

**§7 model decision (logged):** 4F analytics are **hospital-scoped** and derive every report from the existing **Phase 2E aggregate operational report** (`getOperationalReport`, which the privacy script proves carries no nominative field). I deliberately did **NOT** add a cross-hospital analytics path — preserving the **Phase 3D rule** that `central.aggregate.view` is the *sole* cross-hospital capability and central reads snapshots only. The spec's "hospital-scoped OR central-aggregate" is satisfied as an OR; this is the conservative choice against the "no patient-level central disclosure" constraint.

## 3. THE GUARANTEE — aggregate-only, no AI, no auto-schedule, no patient leakage
- **A run reuses the aggregate operational report** (`getOperationalReport`, gated by `report.operational.read`) and transforms it into aggregate rows via `buildAnalyticsRows` — it never touches patient-level tables.
- **Aggregate-only guard (last gate):** `assertAggregateReportRows` rejects any row carrying a non-whitelisted key (a leaked patient identifier) or a non-numeric value — enforced **before storing** the run result **and again at export**. A row may only carry `section / dimension / subDimension / label / value`.
- **Guarded runs:** PENDING → COMPLETED/FAILED via a guarded `updateMany` (a concurrent double-complete loses). Only a COMPLETED run may be exported.
- **No auto-schedule:** `SCHEDULED_PLACEHOLDER` is a manual run tagged as if scheduled; `schedulePlaceholder` is a documentary cron string that is **never executed** (no scheduler / background job — mock-first).
- **No AI/ML.** Deterministic aggregation only.

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `analytics.report.manage` (**administrateur** — define / run / export) and `analytics.report.view` (**administrateur** + **directeur** — read). The screen is gated on `view OR manage`; management + run are `manage`-only. Per-hospital; cross-hospital denied.
- **Audit**: `analytics.definition_created`, `analytics.definition_updated`, `analytics.report_run`, `analytics.report_exported`.

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/analytics.test.ts` (5) — definition validation, `resolveTopN` clamp, per-kind `buildAnalyticsRows`, the aggregate-only guard (rejects a `patientNumber` key + a non-numeric value), CSV serialisation.
- **integration** `tests/integration/phase4f-analytics.test.ts` (4) — define + run (aggregate rows only; **no patient name/number/phone in the run result**; audited); export registry (CSV + JSON; aggregate-only; audited); guards (disabled definition cannot run; a non-COMPLETED run cannot be exported); RBAC (clinical denied; director view-only cannot manage/run; cross-hospital denied).
- **component** `tests/component/analytics-admin-4f.test.tsx` (3) — definition form lists all kinds; run form offers both triggers; export offers CSV + JSON.
- **e2e** `tests/e2e/integration-analytics-4f.spec.ts` (2) — admin defines → runs → exports (registry confirmation); clinical doctor redirected (RBAC).
- **privacy**: `scripts/check-privacy.ts` extended to statically assert `lib/analytics.ts` / `analytics-report-service.ts` / `analytics-reports.ts` reference **no nominative token** and the aggregate-row whitelist is the strict set.
- **Suite at this tip:** unit+component **391**, integration **328** (vitest **719**), Playwright **e2e 63** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase4/4F/`](../qa-command-output/phase4/4F/); screenshot [`docs/phase4f-screenshots/`](../phase4f-screenshots/).

## 6. Privacy basis
Reports are built **exclusively** from the already-hardened Phase 2E aggregate report (no nominative field), transformed by a pure function that can only emit whitelisted aggregate keys, and passed through `assertAggregateReportRows` before both persistence and export. The integration test proves a distinctive patient name / number / phone never reaches a run result; the privacy script statically forbids nominative tokens in the analytics source. This layered guarantee is the safety basis in lieu of a separate adversarial workflow.

## 7. Known issues
None. Pre-existing non-blocking `phase3f1` lint warning.

## 8. Boundary confirmation
Synthetic only · **AGGREGATE-ONLY — no AI/ML, no patient-level data, no patient-level central disclosure** · hospital-scoped (never reads cross-hospital operational data) · scheduled runs are placeholders (no live scheduler) · guarded runs + export-requires-COMPLETED · integer FCFA · admin/director-gated · server-side RBAC · audited · additive schema (§7) · Phase 1A/2/3 golden paths preserved · not Gate 7.

## 9. Files changed
- `prisma/schema.prisma` (+4 enums, +3 models, Hospital back-relations), `prisma/migrations/20260701050000_phase4f_analytics/migration.sql`.
- `lib/analytics.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+4 actions); `scripts/check-privacy.ts` (+analytics aggregate-only assertions).
- `server/db/analytics-reports.ts` + `server/db/index.ts`; `server/services/analytics-report-service.ts` + `server/services/index.ts`; `server/actions/analytics-actions.ts`.
- `app/(app)/administration/analytics/page.tsx`; `components/admin/analytics-admin.tsx`; `components/layout/nav.ts` (+nav item, BarChart3); `messages/fr.json` / `messages/en.json` (`analytics` ns + nav); `tests/unit/i18n-parity.test.ts` (+`analytics`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4F/`, `docs/phase4f-screenshots/`.
