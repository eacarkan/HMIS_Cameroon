# Phase 2A — Implementation Log — Department / Service Configuration Foundation

**For:** mentor review · **Data:** synthetic / fake only · **Status:** committed (one unit, one commit)
**Branch:** `feature/phase2a-service-config` · **Baseline:** Phase 1A QA (`c1b1ace`) on `feature/gate4-ui-workflows`
**"Go-live" here = controlled synthetic-data UAT, NOT real operation. Not Gate 7. No real patient data. No production authorization.**

## 1. Objective
Build the hospital-scoped, **bilingual (Fr/En)** service/department **catalogue** that every later Phase 2 module routes through, seed the **Bertoua** standard structure (synthetic), and introduce **capability-based RBAC** in which the Hospital Administrator is **not** a clinical/billing superuser.

## 2. Schema / migration decision (stop-and-propose → approved)
Proposed and approved **extending the existing `ServiceUnit`** model **additively** (no new model). First Phase 2 migration: `prisma/migrations/20260629183337_phase2a_service_catalogue` — `CREATE TYPE "ServiceType"` (9 codes) + `ALTER TABLE "ServiceUnit" ADD COLUMN` ×12 (all defaulted/nullable: `nameFr`, `nameEn`, `type` default `SUPPORT`, `displayOrder` default 0, 8 eligibility booleans default false) + one index. **Strictly additive — no drop/rename/data-loss.** Existing fields (`name`, `kind`, `departmentId`, `isActive`) kept; Phase 1A flows untouched.

## 3. Files changed
- **Schema/seed:** `prisma/schema.prisma` (+`ServiceType` enum, +12 cols), `prisma/migrations/20260629183337_phase2a_service_catalogue/`, `prisma/seed-data.ts` (Bertoua standard catalogue, synthetic; legacy units bumped below it).
- **Pure lib (new):** `lib/service-catalogue.ts` (`SERVICE_TYPES`, `validateServiceCatalogueInput` incl. flag↔type consistency, `normalizeDisplayOrder`, `ELIGIBILITY_FLAGS`).
- **RBAC:** `lib/rbac/index.ts` (+`service.config.manage`/`service.config.view`; **administrateur de-scoped** from `patient/encounter/consultation/invoice.create`, `payment.record`, `receipt.print`).
- **Data-access:** `server/db/config.ts` (catalogue fields on create/update; `listServiceUnitsOrdered`, `listActiveServiceUnits`, `reorderServiceUnits`), `server/db/index.ts`.
- **Service:** `server/services/config-service.ts` (`createServiceUnit`/`updateServiceUnit`/`deactivateServiceUnit`/`reactivateServiceUnit`/`reorderServices`/`setServiceEligibility`/`listServiceCatalogue`/`listActiveServices`), `server/services/audit-service.ts` (+6 `service.*` actions), `lib/constants/index.ts` (+French audit labels + `SERVICE_TYPE_LABELS_FR`), `server/services/index.ts`.
- **Actions/UI:** `server/actions/config-actions.ts` (catalogue actions), `components/admin/service-catalogue.tsx` (new), `app/(app)/administration/page.tsx`.
- **Bilingual i18n (new + changed):** `i18n/request.ts` (cookie + French-base merge fallback), `messages/en.json` (new), `messages/fr.json` (+keys), `server/actions/locale-actions.ts` (new), `components/layout/language-toggle.tsx` (new), `components/layout/topbar.tsx`.
- **Downstream consumer:** `components/encounters/encounter-form.tsx` + `app/(app)/patients/[id]/visite/nouvelle/page.tsx` (visit form sources active services from the catalogue; safe fallback).
- **Tests (new):** unit / integration / component / e2e `service-catalogue.*`; `tests/unit/rbac.test.ts` updated for the de-scope.

## 4. Services
Hospital-scoped, audited catalogue CRUD: create / update (identity: name/type/order/department, flags preserved) / deactivate / reactivate / reorder (atomic, id-membership guarded) / setServiceEligibility (validated against type) ; `listServiceCatalogue` (manage; incl. inactive) and `listActiveServices` (view; active only). Validation via the pure lib.

## 5. UI + i18n
Admin **service-catalogue** screen: ordered list (type + status + eligibility badges), create/edit forms, reorder (up/down), deactivate/reactivate, eligibility toggle. All new UI via **Fr/En** next-intl keys; an in-topbar **language toggle** (cookie; French default; English overlaid on the French base so untranslated keys fall back to French — progressive i18n). Non-admin config readers get an active-only read view; the new-visit form is a **downstream consumer** of the active catalogue.

## 6. RBAC changes
New capabilities `service.config.manage` (Hospital Admin) and `service.config.view` (all operational roles + director, **active services only**). **administrateur de-scoped** from clinical/billing data-entry (capability-based; this also resolves the Phase 1A-review admin-breadth limitation). Cross-hospital access denied; every new query hospital-scoped.

## 7. Audit changes
New append-only actions `service.created` / `service.updated` / `service.deactivated` / `service.reactivated` / `service.reordered` / `service.eligibility_changed`, with French labels.

## 8. Tests run + results (cumulative)
`npm run typecheck` ✅ · `npm run lint` ✅ · `npm run build` ✅ · unit + component **127** · integration **94** · e2e **19** · `npm run smoke:test` ✅ GOLDEN PATH · `npm run check:arch` ✅ · `npm run check:privacy` ✅. New coverage: lib validation + RBAC re-scope (unit); catalogue CRUD + scoping + RBAC + audit + admin de-scope (integration); catalogue rendering (component); admin management + bilingual toggle + RBAC denial (e2e).

## 9. Known issues / notes
- Existing legacy seed units `SU-CONSULT-1`/`SU-CAISSE-1` are kept (additive) and pushed to the end of the catalogue order so "Médecine générale" remains the visit-form default (golden path unchanged).
- `administrateur` retains oversight READS (patient/encounter/consultation/invoice read, audit) but no data-entry — by design (spec §8).
- **Defense-in-depth (carried over from Phase 1):** the `server/db/config.ts` `update*` helpers update by `id` only; hospital scoping is enforced one layer up (the service always calls `findServiceUnitById(ctx.hospitalId, id)` first, and `reorderServiceUnits` already scopes via `updateMany({ where: { id, hospitalId } })`). Adding `hospitalId` to the single-row `update` would require switching to `updateMany` + re-fetch across the shared config helpers — deferred as a project-wide hardening pass, not done in 2A. Surfaced by the adversarial review (minor).
- Reviewed adversarially (6 dimensions): schema/migration, scoping/audit, i18n, spec-compliance, correctness — no blockers; the create-form post-submit reset was fixed.

## 10. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real-data/production authorization · additive schema only (one reviewed migration) · hospital-scoped · capability-based RBAC (Admin not clinical) · bilingual keys · **no queue / pharmacy / lab / imaging / hospitalization logic** · no Phase 4/deferred items · `01_Administratif_et_Contrat/**` and `02_Package_Contractuel_Final/**` untouched. **"Go-live" = controlled synthetic-data UAT, not real operation.**
