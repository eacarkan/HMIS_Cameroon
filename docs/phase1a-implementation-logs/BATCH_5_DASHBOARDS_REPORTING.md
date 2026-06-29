# Phase 1A — Batch 5 Implementation Log — Dashboard / reporting strengthening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed)
**Branch:** `feature/phase1a-batch-5-dashboards-reporting` · **Commit:** `20af387` (parent `a56d03f`)

## 1. Objective
Role-specific operational visibility — daily patient / encounter / billing / cashier summaries and basic management indicators — as **read-only aggregations over existing data**, with **no BI / data warehouse and no cross-hospital analytics**.

## 2. Schema / migration decision
**No schema change, no migration, no new write models.** All figures are read-only `count`/`aggregate` queries over existing models, hospital-scoped.

## 3. Files changed
- **New:** `lib/dashboard-metrics.ts` (capability-driven section visibility + daily billing breakdown), `components/dashboard/dashboard-kpis.tsx` (role-specific KPI sections), tests (`tests/unit/dashboard-metrics.test.ts`, `tests/component/dashboard-kpis.test.tsx`, `tests/e2e/views-dashboard.spec.ts`), `docs/batch5-screenshots/`.
- **Modified:** `server/db/dashboard.ts` (+`countEncountersOpenedSince`, `countEncountersClosedSince`, `countConsultationsSince`, `countInvoicesSince`, `findPaymentsSince`), `server/db/index.ts`, `server/services/dashboard-service.ts` (richer role-aware summary), `features/dashboard/dashboard-overview.tsx` (sections + management-only recent panel), `messages/fr.json`, `tests/integration/dashboard.test.ts`.

## 4. Services changed
`getDashboardSummary` now returns capability-driven `sections` plus daily aggregations (patients, encounters opened/closed, consultations, invoices, collections, and payments **by mode**), all hospital-scoped and read-only.

## 5. UI changed
Dashboard renders **role-specific sections**: *Activité du jour* (all), *Activité clinique* (clinicians), *Facturation & caisse* (cashier/oversight, incl. totals by mode), and a recent-activity panel for oversight (management) roles.

## 6. RBAC changes
No new capabilities. Section visibility derives from existing capabilities: `dashboard.read` (activity), `consultation.read` (clinical), `invoice.read` (billing), `audit.read`/`config.read` (management). So reception sees activity only; doctor adds clinical; cashier adds billing; director/admin see all + management. Hospital-scoped.

## 7. Audit changes
None (read-only views).

## 8. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **99** (+8); integration **84** (+2); e2e **16** (+1); smoke GOLDEN PATH PASSED; check:arch ✓; check:privacy ✓. Verified: aggregation correctness; role-specific sections per role; **figures hospital-scoped (another hospital's 9 999 not included)**.

## 9. Screenshots (fake data)
`docs/batch5-screenshots/`: `01-cashier-dashboard.png` (billing/cashier section), `02-reception-dashboard.png` (activity only, no billing/clinical).

## 10. Known issues / notes
The recent-activity panel is shown only to oversight (management) roles. Aggregations use indexed `count`/`aggregate` queries; on larger demo datasets they remain bounded (per-day windows). The role-dashboard e2e sorts last and creates no data.

## 11. Boundaries respected
Fake data only; no real-data/production authorization; **no BI / data warehouse, no external BI tool, no cross-hospital analytics** (Phase 3); read-only aggregations only; no schema/migration/new write models; strict hospital scoping; layering + arch/privacy guardrails intact; contract/admin folders untouched.
