# Phase 1A — Batch 6 Implementation Log — Pilot-readiness technical hardening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed) · **Final Phase 1A batch**
**Branch:** `feature/phase1a-batch-6-pilot-readiness` · **Commit:** `9cf2a30` (parent `a8daf16`)

## 1. Objective
Make the application operable, observable, and clearly fenced for pilot — environment validation, data-mode separation (real-data path disabled), a health/status page, app-level backup/restore readiness hooks, consistent error handling, and expanded privacy/architecture/test coverage — **without enabling any real-data path or deployment**.

## 2. Schema / migration decision
**No schema change, no migration.** Data mode is an env/config flag (`HMIS_DATA_MODE`) resolved by a pure lib, not a DB column. The real-data path is a compile-time constant (`REAL_DATA_ENABLED = false`).

## 3. Files changed
- **New:** `lib/data-mode.ts`, `lib/env-validation.ts`, `app/(app)/etat-systeme/page.tsx` (status page), `app/(app)/error.tsx` (error boundary), tests (`tests/unit/data-mode.test.ts`, `tests/integration/system-status.test.ts`, `tests/component/app-error.test.tsx`, `tests/e2e/views-system.spec.ts`), `docs/batch6-screenshots/`.
- **Modified:** `server/services/system-service.ts` (+`getSystemStatus`), `server/services/index.ts`, `scripts/check-architecture.ts` (lib-purity rule), `scripts/check-privacy.ts` (real-data-disabled + fake-data marker checks), `components/layout/nav.ts` (+ État du système), `messages/fr.json`, `tests/e2e/security-admin.spec.ts` (made deterministic — see notes).

## 4. Services changed
`getSystemStatus` reports **real** signals — DB reachability, app version, data mode, env validation — plus app-level readiness items (incl. an explicit "backup = supplier concern" item). No false confidence.

## 5. UI changed
`/etat-systeme` status page (oversight roles) with the visible "DÉMO / PILOTE — données fictives" marker, health card, and pilot-readiness checklist; a consistent French error boundary for the authenticated app; an "État du système" nav item.

## 6. RBAC changes
No new capabilities. Status page gated on `config.read` (admin/director). Hospital-scoped where applicable.

## 7. Audit changes
None (read-only/observability).

## 8. Guardrail expansions
- `check-architecture.ts`: new rule — `lib/` must not import `@/server` (keeps the pure libs from Batches 1A–5 client-safe). Passes.
- `check-privacy.ts`: asserts `REAL_DATA_ENABLED = false` (real-data path disabled, fail-closed) and the visible fake-data marker is present. Passes.

## 9. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **104** (+5); integration **85** (+1); e2e **17** (+1); smoke GOLDEN PATH PASSED; check:arch ✓ (incl. lib purity); check:privacy ✓ (incl. real-data-disabled). Verified: data-mode fail-closed (`real` → `demo`); env validation fail-closed; system status real signals; error boundary hides internals; backup is reported as a supplier concern.

**Phase 1A coverage summary (cumulative):** unit + component **104**, integration **85**, e2e **17**, plus golden-path smoke (13 checks) and the architecture + privacy guardrails — all green. (A line-coverage % tool was intentionally not added to avoid a new dependency; coverage was expanded via comprehensive unit/component/integration/e2e tests across Batches 1A–6.)

## 10. Screenshots (fake data)
`docs/batch6-screenshots/`: `01-system-status.png` (status + data-mode marker + readiness).

## 11. Known issues / notes
Automatic failed-attempt lockout counters remain a proposed additive migration (Batch 4 note), not built. The `security-admin` e2e (Batch 4) was made **deterministic** here: it now verifies the change-password form + server-side policy (weak password rejected → no mutation) and an audit detail, instead of mutating/restoring a seeded password through the live session (which raced React 19's post-action form reset). The successful password-change and admin-reset paths remain covered end-to-end in the integration suite.

## 12. Boundaries respected
Fake data only; no real-data/production authorization; **no production deployment, no real backup infrastructure, no infrastructure provisioning**; real-data path disabled and visibly marked; no schema/migration; layering + arch/privacy guardrails intact (and expanded); contract/admin folders untouched.

---

**Phase 1A coding is complete (Batches 1A → 6).** Phase 2 does not begin until hospital-audit confirmation and mentor/MINSANTE approval (`Phase_2_Operational_Modules_Gated_Prompt.md`).
