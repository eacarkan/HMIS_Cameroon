# Step 14 — Testing & QA

**Date:** 2026-06-27 · **Scope:** a practical test + QA layer for the existing Phase-0
walking skeleton. No new product features; only test code, tooling, docs, and any
defect fixes needed to make the already-intended skeleton pass.

## Purpose

Prove the walking skeleton is reliable, demoable, architecture-compliant and safe across
ten categories: static quality, unit, service/integration, DB-backed fake-data, RBAC +
hospital-scoping, component, E2E, receipt consistency, dashboard/audit reconciliation,
and a manual UAT script.

## Test tools added (devDependencies)

| Tool | Why |
|---|---|
| `vitest` | unit + integration test runner (node + jsdom projects) |
| `vite-tsconfig-paths` | resolve `@/` aliases in Vitest |
| `jsdom` | DOM environment for component tests |
| `@testing-library/react` / `dom` / `user-event` / `jest-dom` | component testing + DOM matchers |
| `@playwright/test` (+ chromium) | browser E2E |

No heavy/exotic frameworks were introduced.

## Files created

- **Config:** `vitest.config.ts` (projects: unit/component/integration), `playwright.config.ts`.
- **Setup/helpers:** `tests/setup/db.ts` (TEST_DATABASE_URL guard), `tests/setup/rtl.ts`,
  `tests/helpers/{db,actors,golden,render}.ts`, `tests/e2e/{_helpers.ts,global-setup.ts}`.
- **Unit:** `tests/unit/{money,numbering,rbac,dates,validation}.test.ts`.
- **Integration:** `tests/integration/{auth,scoping-rbac,patient,encounter,consultation,billing,receipt,dashboard,audit}.test.ts`.
- **Component:** `tests/component/{prototype-banner,page-header,sidebar,topbar,receipt-document}.test.tsx`.
- **E2E:** `tests/e2e/{golden-path,rbac}.spec.ts`.
- **Scripts:** `scripts/{setup-test-db,check-architecture,check-privacy}.ts`; hardened `scripts/golden-path.ts`.
- **Docs:** this file, `docs/testing/UAT_PHASE_0_WALKING_SKELETON.md`.

## Package scripts

`typecheck`, `lint`, `build`, `test` (unit+component), `test:unit`, `test:component`,
`test:integration`, `test:e2e`, `test:all`, `smoke` / `smoke:test` (test DB, safe
default) / `smoke:dev` (dev DB, manual-only), `check:arch`, `check:privacy`,
`db:test:setup`.

`test:all` runs: typecheck → lint → unit → component → integration → build → e2e.

**Smoke-test DB safety:** `npm run smoke` and `npm run smoke:test` run the golden path
against `TEST_DATABASE_URL` and **refuse any database whose name does not contain
`test`** (the script sets `DATABASE_URL` from `TEST_DATABASE_URL` before Prisma loads).
`npm run smoke:dev` (`SMOKE_DEV=true`) targets the development `DATABASE_URL` and is
**manual/dev-only — fake data only, never with real data**.

## Database / test-data approach

- **Dedicated test DB** via `TEST_DATABASE_URL` (e.g. `hmis_cameroon_test`). Integration
  and E2E **refuse to run** unless the DB name contains `test` — they can never wipe the
  dev (or any non-test) DB. Each integration test resets/seeds fake demo data; E2E resets
  once in `global-setup`. The Playwright web server runs with `DATABASE_URL` pinned to the
  test DB. **No real data; no production DB; no committed credentials** (`.env` gitignored,
  `.env.example` has placeholders).
- One-time setup: `npm run db:test:setup` (creates the DB + pushes the schema).

## Commands to run

```bash
npm run typecheck && npm run lint && npm run build   # static quality
npm run test          # unit + component (no DB)
npm run db:test:setup # once: create + migrate the test DB
npm run test:integration
npm run test:e2e
npm run smoke:test    # golden-path assertions on the TEST database (safe default)
# npm run smoke:dev   # same, against the DEV database (manual/dev-only; fake data only)
npm run check:arch && npm run check:privacy
```

## Results (this run)

| Suite | Result |
|---|---|
| typecheck | ✅ pass |
| lint | ✅ pass |
| build | ✅ pass |
| unit (5 files, 25 tests) | ✅ pass |
| component (5 files, 8 tests) | ✅ pass |
| integration (9 files, 26 tests) | ✅ pass |
| e2e (7 tests, 6 flows) | ✅ pass |
| smoke:test (golden-path, TEST DB) | ✅ pass |
| check:arch | ✅ pass |
| check:privacy | ✅ pass |

## Test coverage summary

App shell, login + hospital selection, patient (search-before-create + banner),
encounter, consultation, billing/payment, receipt, dashboard, audit, RBAC (service-side
+ route guard + nav filter), hospital scoping, fake-data consistency, integer-FCFA money,
deterministic numbering.

## Skipped / pending

- **Async server components** (`PatientBanner`, `DashboardOverview`) are not unit-rendered
  via RTL (they use server `getTranslations`); they are covered by E2E instead.
- **Browser print dialog** is not driven; the receipt **preview page/content** is tested.
- No coverage thresholds / mutation testing (out of scope for a prototype).

## Bugs found and fixed

- None in product code. Two **test-only** selector issues were fixed (strict-mode text
  match; consultation submit button label) and one integration assertion was corrected
  (dashboard recent-activity is capped at the 8 newest entries).

## Bugs found but not fixed

- None.

## Architecture & privacy guardrails

- `check:arch`: no `@prisma/client` / `@/server/db` imports in `app/`, `components/`,
  `features/`; the service + data-access layers exist (complements the ESLint rule).
- `check:privacy`: no secrets; `.env` gitignored; prototype label present in app + receipt;
  all demo accounts use the fake `@hrb-demo.cm` domain.

## Recommendation

The walking skeleton is **ready for screenshot/design review, code/architecture review,
and user-acceptance review**. No blocking defects. Suggested follow-ups (post-audit, not
blocking): CI to run `test:all`, coverage reporting, and Playwright traces in CI.
