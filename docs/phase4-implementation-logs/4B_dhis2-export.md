# Phase 4B — DHIS2 Configurable Export / API-Readiness

**Batch:** 4B · **Branch:** `feature/phase4b-dhis2` (stacked on 4A) · **Commit message:** `Phase 4B: add configurable DHIS2 export and API-readiness framework`

> **Aggregate-only · synthetic data only · NOT Gate 7 · no real DHIS2 credentials/API/codes · mock API OFF by default.** Doc 39 §3 (4B), §5, Prompt 4B; builds on 4A + Phase 2E DHIS2 CSV.

## 1. Objective
A configurable **DHIS2 mapping + export-readiness** framework on top of 4A: per-hospital mapping sets (org-unit / data-element / category-option-combo **placeholders** — non-secret, non-final), **validation before export**, the **preserved** Phase 2E manual CSV, and an **optional mock API export** (through the 4A mock connector — no network).

## 2. Schema (additive — §7 rule: proceed + log)
Migration `20260701010000_phase4b_dhis2_mapping` (additive; no existing-table change):
- **`Dhis2MappingSet`** (`@@unique[hospitalId, code]`) — named set + `orgUnitPlaceholder`; `Hospital` FK + back-relation.
- **`Dhis2Mapping`** (`@@unique[mappingSetId, localElement]`) — maps a local aggregate element (e.g. `CONSULTATIONS`, `DIAG:B50`, or a wildcard `DIAG:*`) → `dataElementPlaceholder` (+ optional `categoryOptionComboPlaceholder`). Placeholders are non-secret, non-final.

## 3. Architecture (aggregate-only, validate-before-export, mock API)
- **`lib/dhis2-mapping.ts`** (pure): `validateMappingSetInput` / `validateMappingInput`; `matchesLocalElement` (exact + `PREFIX:*` wildcard); `classifyExportRows` (mapped vs unmapped → readiness); **`assertAggregateOnly`** (rejects any non-aggregate field — belt-and-suspenders privacy).
- **`server/services/operational-report-service.ts`** — added an **additive** `buildDhis2RowsForPeriod` (reuses the Phase 2E private row-builder; the 2E export is unchanged).
- **`server/db/dhis2-mapping.ts`** — hospital-scoped mapping CRUD.
- **`server/services/dhis2-mapping-service.ts`** — mapping CRUD (`dhis2.mapping.manage`); `getDhis2ExportReadiness` (validation before export); `exportDhis2MappedCsv` (gated on a COMPLETE mapping → the Phase 2E CSV, aggregate-only, audited); `runDhis2MockApiExport` (validate → **4A MOCK connector, NO network** → `ReportExport` + audit). Both export paths run `assertAggregateOnly` before emitting anything.
- **UI**: `app/(app)/administration/dhis2/page.tsx` + `components/admin/dhis2-admin.tsx` + `app/(app)/administration/dhis2/export/route.ts` (CSV download). "Aggregate only / mock API — no live call" notice; Fr/En.

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `dhis2.mapping.manage`, `dhis2.export.run` → **`administrateur`** only. Per-hospital; cross-hospital denied; clinical roles denied.
- **Audit**: `dhis2.mapping_updated`, `dhis2.export_csv`, `dhis2.export_mock_api`.

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/dhis2-mapping.test.ts` (5) — validation, exact/wildcard matching, mapped/unmapped classification, aggregate-only guard.
- **integration** `tests/integration/phase4b-dhis2-mapping.test.ts` (5) — CRUD hospital-scoped + audited; clinical DENIED + cross-hospital denied; **validation before export** (unmapped → export refused, then ready after mapping); **CSV aggregate-only** (planted patient name/number absent); **mock API export with NO network** (`fetch` spy → 0 calls) + `ReportExport` + audit.
- **component** `tests/component/dhis2-admin-4b.test.tsx` (2) — forms render.
- **e2e** `tests/e2e/integration-dhis2-4b.spec.ts` (2) — admin creates a mapping set → adds a mapping → runs a mock API export; clinical role redirected (RBAC).
- **Suite at this tip:** unit+component **358**, integration **308** (vitest **666**), Playwright **e2e 54** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓ (DHIS2 export asserted aggregate-only). Evidence [`docs/qa-command-output/phase4/4B/`](../qa-command-output/phase4/4B/); screenshot [`docs/phase4b-screenshots/`](../phase4b-screenshots/).

## 6. Known issues
None. Pre-existing non-blocking `phase3f1` lint warning.

## 7. Boundary confirmation
Aggregate-only (no patient-level, no nominative field — `assertAggregateOnly` guard) · **no real DHIS2 API/credentials/codes** (placeholders only) · manual CSV preserved · mock API through the 4A mock connector (**no network**; live flag off) · hospital-scoped (service + DB) · server-side RBAC · audited · additive schema (§7) · Phase 1A/2/3 golden paths preserved · not Gate 7 · not production.

## 8. Files changed
- `prisma/schema.prisma` (+2 models, Hospital back-relation), `prisma/migrations/20260701010000_phase4b_dhis2_mapping/migration.sql`.
- `lib/dhis2-mapping.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+3 actions).
- `server/db/dhis2-mapping.ts` + `server/db/index.ts`; `server/services/dhis2-mapping-service.ts` + `server/services/index.ts`; `server/services/operational-report-service.ts` (+`buildDhis2RowsForPeriod`); `server/actions/dhis2-actions.ts`.
- `app/(app)/administration/dhis2/page.tsx` + `export/route.ts`; `components/admin/dhis2-admin.tsx`; `components/layout/nav.ts` (+nav item); `messages/fr.json` / `messages/en.json` (`dhis2` ns + `nav.dhis2`); `tests/unit/i18n-parity.test.ts` (+`dhis2`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4B/`, `docs/phase4b-screenshots/`.
