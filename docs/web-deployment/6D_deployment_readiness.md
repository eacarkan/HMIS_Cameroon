# Phase 6D — Deployment Environment Readiness (Vercel + Neon)

**Batch:** 6D · **Spec:** Doc 43 §8 (+ Doc 42 §8, §9, §11) · **Commit message:** `Phase 6D: add Vercel and Neon deployment readiness`
**Boundary:** no deployment/domain/resource creation here · no secrets committed · live flags off · one-click flag default off · stakeholder-demo marker · synthetic.

## What was implemented
- **`docs/web-deployment/SanteGrid_Deployment_Runbook.md`** — the SanteGrid.com · Vercel Pro · Neon deployment runbook: prerequisites, Neon setup, Vercel setup, domain/HTTPS, the **env-var checklist** (placeholders only), schema `db push` + synthetic seed, smoke/health verification, reset/backup/rollback pointers, stakeholder handoff, and the boundaries.
- **`app/api/health/route.ts`** — a safe **public health route** (no auth, no DB, no patient data, no secrets) returning app-up + `environment` + `dataMode` + `syntheticDataOnly:true` + `liveIntegrations:false` + version markers.
- **`.env.example`** — added the Phase 6 deployment block (placeholders only): `HMIS_ENVIRONMENT=stakeholder-demo`, `HMIS_PUBLIC_SITE_ENABLED=true`, **`HMIS_PUBLIC_DEMO_LOGIN_ENABLED=false`**, `HMIS_SYNTHETIC_DATA_ONLY=true`, `HMIS_SHOW_SYNTHETIC_BANNER=true`, `HMIS_INTEGRATION_LIVE_ENABLED=false`, `HMIS_MPI_LIVE_ENABLED=false`, `NEXT_PUBLIC_DEMO_PASSWORD_HINT=""`. The runbook documents setting `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true` in Vercel **only** for the controlled stakeholder demo.

## Files changed
- **New** `app/api/health/route.ts`, `docs/web-deployment/SanteGrid_Deployment_Runbook.md`.
- **Edit** `.env.example` — Phase 6 deployment placeholders (one-click + live flags off by default).
- **New tests** `tests/unit/health-route.test.ts` (2), `tests/unit/deployment-env.test.ts` (4); **Edit** `tests/e2e/public-site.spec.ts` (+/api/health).

## Schema / migration
**None.** Env/data-mode markers + a stateless health route only.

## RBAC / audit
Health/status is public but **non-sensitive** — no data exposure, no capability grants, no new audit events. Live-integration and one-click flags fail closed.

## Tests run + results (`docs/qa-command-output/web-deployment/6D/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green (no secrets; `.env` gitignored) · `check:i18n` **26** · `test` **453** (+6: health route + env defaults) · `build` green (`/api/health` registered).
- The health-route test asserts a safe payload with **no secrets/connection strings/passwords**; the env test asserts one-click + live integrations are `false` by default and no managed connection string is embedded.

## Screenshots / evidence
QA transcripts in `docs/qa-command-output/web-deployment/6D/`. The `/api/health` JSON + status page screenshot are captured in the 6G FINAL pass.

## Known issues
None. (Actual deployment, domain purchase and resource creation are explicitly out of scope and not performed.)

## Boundary confirmation
No deployment/domain/resource creation here · no secrets committed (placeholders only; `.env` gitignored) · live flags off · one-click flag default off in `.env.example` · stakeholder-demo marker present · synthetic · no schema change · no `01_`/`02_` changes · not merged/pushed.
