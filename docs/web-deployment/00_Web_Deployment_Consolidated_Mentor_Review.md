# Phase 6 — SantéGrid Web-Deployment Preparation — Consolidated Mentor Review

**Project:** HMIS Cameroon (SIGH/DME) prototype · **Phase 6 (internal naming):** controlled public **stakeholder-review web-deployment preparation** under the **SantéGrid** brand (domain target **SanteGrid.com**, hosting **Vercel Pro**, DB **Neon PostgreSQL**). **Branch:** `feature/phase6-santegrid-web-deployment` (stacked from the Phase 5.1 accepted tip `5540f64`). **Specs:** Doc 42 v1.2 + Doc 43 v1.2.

> **This phase PREPARES the app and STOPS before real deployment.** Synthetic data only · stakeholder-demo only · mock/sandbox-first · not production · not Gate 7 · not real data · not hospital operational use · no live integrations · **not an official government website** (no MINSANTE in domain/brand). Not merged to `main`; not pushed.

> **Phase 6.1 pre-deployment corrections applied** (on `feature/phase6-1-predeployment-corrections`, from `f135a88`): (1) the demo password is no longer committed — it is env-controlled via `HMIS_DEMO_SHARED_PASSWORD` (server-side, fails closed) with an optional public `NEXT_PUBLIC_DEMO_PASSWORD_HINT`; (2) the one-click audit event is renamed `demo.session_started` → `demo.session_requested` (the confirmed session is `auth.login`). See [Phase_6_1_PreDeployment_Correction_Report.md](Phase_6_1_PreDeployment_Correction_Report.md).

## 0. Index (batches, commits, logs, evidence)

| Batch | Commit | Implementation log | QA evidence |
|---|---|---|---|
| **6A** Public landing + SantéGrid branding | `511a6ab` | [6A_landing_and_branding.md](6A_landing_and_branding.md) | [qa/6A](../qa-command-output/web-deployment/6A/) |
| **6B** Public feature showcase | `29fc801` | [6B_feature_showcase.md](6B_feature_showcase.md) | [qa/6B](../qa-command-output/web-deployment/6B/) |
| **6C** Demo access + account directory | `f61da6d` | [6C_demo_access.md](6C_demo_access.md) | [qa/6C](../qa-command-output/web-deployment/6C/) |
| **6D** Vercel + Neon deployment readiness | `71d69ff` | [6D_deployment_readiness.md](6D_deployment_readiness.md) | [qa/6D](../qa-command-output/web-deployment/6D/) |
| **6E** Demo reset + backup runbook | `2dea13c` | [6E_reset_and_backup.md](6E_reset_and_backup.md) | [qa/6E](../qa-command-output/web-deployment/6E/) |
| **6F** Stakeholder feedback (email-only) | `db73b81` | [6F_feedback.md](6F_feedback.md) | [qa/6F](../qa-command-output/web-deployment/6F/) |
| **6G** Deployment QA + handoff | *(this commit)* | this document | [qa/FINAL](../qa-command-output/web-deployment/FINAL/) |

Chain from `5540f64`: `511a6ab` → `29fc801` → `f61da6d` → `71d69ff` → `2dea13c` → `db73b81` → **6G (tip)**.

## 1. What was built
- **Public site** (no login, read-only, synthetic) in a new `app/(public)/` route group with its own layout (no auth, no app shell; keeps the prototype banner):
  - `/accueil` — landing: SantéGrid brand + the verbatim positioning line + synthetic-demo + "not an official government website" disclaimers + capabilities + CTAs (6A);
  - `/vitrine` — feature showcase: eleven module preview cards + a banker/accountant proof section + a scope/readiness boundary, **no public writes, no source/architecture exposure** (6B);
  - `/acces-demo` — demo directory of the ten synthetic accounts + flag-gated one-click login for the seven selected roles (6C);
  - `/retours` — email-only stakeholder feedback (no form, no DB) (6F);
  - `GET /api/health` — safe status route (no auth/DB/secrets) (6D).
- **Front door (flag-gated):** with `HMIS_PUBLIC_SITE_ENABLED=true`, an unauthenticated visitor to a protected route lands on `/accueil`; default off preserves the existing `/connexion` flow (6A).
- **Deployment readiness:** the SanteGrid.com/Vercel/Neon runbook + `.env.example` placeholders (live flags + one-click default off) + the health route (6D); the manual reset/backup runbook (6E); the feedback process (6F); the Go/No-Go checklist (6G).

## 2. Per-batch guarantees (all tested)

| Batch | The guarantee |
|---|---|
| **6A** | Public landing renders without auth; SantéGrid brand + positioning line + synthetic-demo + not-official-government disclaimers present; no private data; front-door redirect is flag-gated (default off → existing behaviour/tests unchanged). |
| **6B** | Showcase renders without auth; eleven modules + proof + readiness; **no `<form>` / no submit button** (no public writes); no patient identifiers; no source/architecture exposure. |
| **6C** | One-click login gated by `canStartOneClickDemo()` (stakeholder-demo **AND** flag) — refused otherwise (server-side, even for a forged POST); allow-listed to the seven synthetic roles (sensitive roles refused); **no client password**; **F-02 lockout preserved** (locked demo account denied even via one-click); `demo.session_requested` audited; passwords never hard-coded/committed in this surface. |
| **6D** | Health route returns a safe payload (app-up + environment + dataMode + `syntheticDataOnly:true` + `liveIntegrations:false`) with no secrets; `.env.example` keeps one-click + live integrations OFF by default; env validation fails closed. |
| **6E** | Synthetic seed/reset is reproducible; a reset restores a clean, unlocked baseline (ten synthetic accounts); manual reset only — no automatic destructive reset. |
| **6F** | Feedback is email-only: no-patient-data warning shown; **no in-app form / input / submit**; **no `FeedbackEntry`/feedback model** in the schema. |

## 3. Schema / migration
**None in the entire phase.** No new Prisma models and no migration. The only data-layer addition is the `demo.session_requested` **audit action code** (6C). Public pages read no operational data.

## 4. RBAC / audit
- RBAC, per-hospital scoping and central aggregate-only are **unchanged**; public pages grant no capabilities and read no operational data.
- New audit event `demo.session_requested` (one-click demo only). Existing `auth.login` / F-02 audits unchanged.
- **F-01 (payment atomicity) and F-02 (account lockout) preserved** — the one-click path signs in through `authenticateCredentials`, so lockout still applies (proven by an integration test).

## 5. Screenshots / evidence
Fr + En screenshots of the four public pages → `docs/qa-command-output/web-deployment/FINAL/screenshots/` (landing, showcase, demo-access, feedback), captured on the production build. Per-batch QA transcripts under `docs/qa-command-output/web-deployment/<batch>/`; the full block under `FINAL/`.

## 6. Final QA (at the 6G tip) — `docs/qa-command-output/web-deployment/FINAL/`
`typecheck` clean · `lint` **0/0** · `test` (unit+component) **458** · `test:integration` **355** → **vitest 813** · `build` green · `smoke` GOLDEN PATH · `check:arch` green · `check:privacy` green · `check:i18n` **27** · `check:release` green · `test:e2e` **78** · **0 MISSING_MESSAGE**.

**Change vs Phase 5.1** (772 vitest / 65 e2e / i18n 22): **+41 vitest** (unit+component 424→458 [+34]; integration 348→355 [+7]) and **+13 e2e** (65→78). The additions are entirely the Phase 6 public-surface tests: deployment-mode + demo-access flag/allow-list units, health-route + env-default units, public branding/showcase/demo/feedback component tests, the demo-access + seed-reproducibility integration tests, five public-route e2e checks, and eight Fr/En screenshot-capture e2e cases. `check:i18n` 22→**27** = the five new bilingual namespaces (`publicSite`, `landing`, `showcase`, `demoAccess`, `feedback`). No prior test changed; no golden path or F-01/F-02 test affected.

## 7. Boundary attestation
Synthetic-demo only · not production · not Gate 7 · not real data · not hospital operational use · **no live integrations** (flags default off; health route reports `liveIntegrations:false`) · **public pages read-only, no writes** · public demo credentials synthetic (`@hrb-demo.cm`); **passwords never hard-coded/committed** in the demo surface · one-click login flag-gated (default off; stakeholder-demo + flag) + allow-listed + audited + **F-02-preserving** · **email-only feedback, no DB model** · manual reset only (no auto-destructive) · SantéGrid brand (no MINSANTE in domain/brand) · **not an official government website** · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`** · **no deployment · no domain purchased · no Vercel/Neon resources created · no real credentials** · not merged to `main` · not pushed.

## 8. Package contents (runbook index)
- **Deployment:** [SanteGrid_Deployment_Runbook.md](SanteGrid_Deployment_Runbook.md) (Neon/Vercel/domain/env/seed/health/rollback/handoff).
- **Reset/backup:** [Demo_Reset_and_Backup_Runbook.md](Demo_Reset_and_Backup_Runbook.md) (manual reset only).
- **Demo accounts:** [Demo_Accounts_and_Access.md](Demo_Accounts_and_Access.md) (directory, one-click, password handling).
- **Feedback:** [Stakeholder_Feedback_Process.md](Stakeholder_Feedback_Process.md) (email-only).
- **Go/No-Go:** [Go_No_Go_Checklist.md](Go_No_Go_Checklist.md) (software-ready vs operator actions).
- **QA evidence:** `docs/qa-command-output/web-deployment/` (per batch + FINAL + screenshots).

## 9. Known issues & recommended next step
- **Known:** lab & radiology one-click buttons share the seeded `technicien_diagnostic` account (seeded role has no modality split — documented); the residual non-blocking `pg` driver-adapter deprecation warning is unchanged. No blocker.
- **Recommended next step (recommend only):** review this package. **Deployment is intentionally NOT performed** — domain purchase, Neon/Vercel resource creation, seeding, and enabling `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true` are **operator actions under a separate, explicit deployment instruction**. Any move to real data / production / live integrations remains an administrative/Gate-7 decision outside software scope. Do not merge to `main` or deploy without explicit instruction.

— Generated for mentor review. Synthetic data only; stakeholder-demo preparation, not deployment; not production; not Gate 7.
