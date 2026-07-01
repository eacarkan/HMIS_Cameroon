# Phase 5C — UAT Scenario Expansion and Synthetic Data Factory

**Batch:** 5C · **Branch:** `feature/phase5c-uat-factory` (from the 5B tip) · **Commit message:** `Phase 5C: expand UAT scenarios and synthetic data factory`

> **Synthetic data only · NOT Gate 7 · no real data · no live integration · no schema change.** Doc 41 §6 (5C), §8.

## 1. Objective
Add a **repeatable synthetic-data factory** + expanded UAT scenarios covering edge cases (emergency debt, insurance claim, duplicate matching, a billed + paid encounter) — deterministic, hospital-scoped, 100% fake.

## 2. What changed (test/doc only — additive, no base-seed / schema change)
- **Synthetic-scenario factory** `tests/helpers/scenarios.ts` — deterministic builders that use the **real** services (so scoping / RBAC / audit fire): `seedBilledEncounter` (billing), `seedEmergencyDebt` (2H treat-first-pay-later), `seedInsuranceClaim` (4E manual claim draft, billing-linked), `seedDuplicateMatch` (4G warning-only candidates). Reusable by demo seeding and tests. It **layers** on top of the base seed and does not modify it or the golden path.
- **Demo-scenario profiles doc** `docs/uat/DEMO_SCENARIO_PROFILES.md` — what each scenario builds + the key assertions, for UAT rehearsal.

## 3. Tests + results (doc 41 §8)
- **integration** `tests/integration/phase5c-demo-factory.test.ts` (2): (1) the factory builds every edge-case artifact (invoice `paid`; emergency debt `outstanding` + encounter `isEmergency`; insurance claim `DRAFT` + billing-linked; ≥1 match `CANDIDATE`); (2) **reproducibility + synthetic-only** — after a reset an identical run yields the identical deterministic patient number + count, and every seeded patient is tagged `DEMO_*` (no real data).
- **Suite at this tip:** unit+component **410**, integration **338** (+2; vitest **748**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0/0** · `check:arch` ✓ · `check:privacy` ✓ (10 fake `@hrb-demo.cm`) · `check:i18n` **22** ✓. Evidence [`docs/qa-command-output/phase5/5C/`](../qa-command-output/phase5/5C/).

## 4. Boundary confirmation
Synthetic only · reproducible (deterministic after reset) · no real data · no live integration (insurance = manual draft, matching = warning-only, no external call) · additive (base seed + golden path untouched) · no schema · all golden paths green.

## 5. Known issues
None new.

## 6. Files changed
- `tests/helpers/scenarios.ts` (factory); `tests/integration/phase5c-demo-factory.test.ts`; `docs/uat/DEMO_SCENARIO_PROFILES.md`; `docs/phase5-implementation-logs/5C_uat-data-factory.md`; `docs/qa-command-output/phase5/5C/`.
