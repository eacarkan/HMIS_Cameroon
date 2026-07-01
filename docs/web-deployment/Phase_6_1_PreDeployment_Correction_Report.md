# Phase 6.1 — Pre-Deployment Correction Report

**Type:** bounded pre-deployment correction patch (NOT Phase 7, NOT a new feature phase) for the two mentor-flagged pre-deployment blockers on the SantéGrid stakeholder-demo web preparation.
**Baseline:** Phase 6 final tip **`f135a88`** · **Branch:** `feature/phase6-1-predeployment-corrections` (stacked) · **Final tip:** the Phase 6.1 commit on this branch (hash in the final response).

> **Boundaries (unchanged):** synthetic data only · stakeholder-demo only · not production · not Gate 7 · not real data · not hospital operational use · no live integrations · not an official government website · **not deployed** · no domain purchased · no Vercel/Neon resources created · no real credentials · **not merged to `main`; not pushed** · no changes under `01_/**` or `02_/**`.

## Blockers dispositioned
1. **Hard-coded / committed demo password → RESOLVED (env-controlled).**
2. **`demo.session_started` audit written before a successful one-click login → RESOLVED (renamed to `demo.session_requested`; confirmed session is `auth.login`).**

---

## Issue 1 — Demo password (6.1A / 6.1B)

**Problem.** The demo password was a committed constant (a hard-coded `DEMO_PASSWORD` literal in `lib/constants/index.ts` and `prisma/seed-data.ts`) used for seeding and one-click login — violating "passwords must not be hard-coded or committed."

**Fix.**
- **Removed** the committed `DEMO_PASSWORD` constants entirely.
- **New** server-only helper `lib/demo-password.ts` → `getDemoSharedPassword()` reads **`HMIS_DEMO_SHARED_PASSWORD`** and **fails closed** (throws a clear operator/developer error) if unset where required. It is never imported by a client component, and the var has **no `NEXT_PUBLIC_` prefix**, so Next.js never inlines it into the client bundle.
- **Seeding** (`prisma/seed-data.ts`) hashes `getDemoSharedPassword()`; **one-click login** (`server/auth/demo-actions.ts`) uses it server-side (fails closed → no-op if unset).
- **Public display** uses the separate, client-safe **`NEXT_PUBLIC_DEMO_PASSWORD_HINT`**; when unset the demo-access + login pages show a clearly-marked placeholder ("Demo password provided by the operator."). No password value is rendered.
- **Tests** inject a deterministic **synthetic** value through their setup (`tests/setup/db.ts`, `playwright.config.ts`) — never a committed product literal.
- `.env.example` carries **placeholders only**: `HMIS_DEMO_SHARED_PASSWORD="<set-in-vercel-or-local-demo-env>"`, `NEXT_PUBLIC_DEMO_PASSWORD_HINT="<optional-public-demo-password-or-hint>"`, `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=false`.

**Seed behavior.** Idempotent; hashes the env password; fails closed if `HMIS_DEMO_SHARED_PASSWORD` is unset.
**One-click behavior.** Unchanged gates (stakeholder-demo + flag + allow-list); now takes the password from the env (server-side), fails closed if unset; **F-02 lockout preserved**.
**Public display behavior.** Username directory public; the password shown only via the operator-controlled `NEXT_PUBLIC_DEMO_PASSWORD_HINT`, else a placeholder.

**Search evidence** (see `docs/qa-command-output/web-deployment/6_1/FINAL/grep-evidence.txt`): searching the code tree (`app components lib server prisma scripts tests messages` + root configs) for the former literal and the old constant returns **no committed password literal and no old constant** — only the env var names `HMIS_DEMO_SHARED_PASSWORD` / `NEXT_PUBLIC_DEMO_PASSWORD_HINT`. The only remaining textual mentions of the old names are in this Phase 6.1 documentation, which describes the removal (not password usage).

---

## Issue 2 — One-click demo audit semantics (6.1C)

**Problem.** `demo.session_started` was written **before** `signIn(...)` confirmed success, so the audit could claim a session started when none did.

**Fix (approach B — rename the pre-login event).** Because the one-click sign-in redirects on success (so success cannot be confirmed cleanly before the redirect), the pre-login event is renamed to **`demo.session_requested`** — an accurate "a one-click demo login was requested and passed pre-checks" event. The **confirmed successful session is already recorded by `auth.login`** (written by `authenticateCredentials` on success), so no misleading "started" claim remains. `demo.session_started` is reserved for a future confirmed-session marker and is **no longer emitted**.

Renamed: audit constant `demoSessionRequested: "demo.session_requested"`; French label; the service function `recordDemoSessionRequest`; the barrel export; and all tests/docs.

**Tests.** `tests/integration/phase6c-demo-access.test.ts` proves `recordDemoSessionRequest` writes `demo.session_requested` for the resolved synthetic account (and is a no-op for an unknown email). The existing Phase 6 guarantees are preserved: flag off / non-stakeholder-demo → one-click refused (`canStartOneClickDemo` unit + e2e disabled note); flag on + stakeholder-demo → the selected synthetic roles resolve; RBAC + hospital scoping preserved; **F-02 lockout preserved on the one-click credential path**.

---

## Files changed
- **New** `lib/demo-password.ts`.
- **Edit** `lib/constants/index.ts` (remove `DEMO_PASSWORD`; audit label rename), `prisma/seed-data.ts`, `scripts/seed.ts`, `server/auth/demo-actions.ts`, `server/services/audit-service.ts`, `server/services/demo-service.ts`, `server/services/index.ts`, `app/connexion/page.tsx`, `.env.example`.
- **Edit scripts** `scripts/golden-path.ts`, `scripts/seed-review-fixture.ts`, `scripts/capture-review-screenshots.sh`, `scripts/capture-review-screenshots.mjs`.
- **Edit tests/infra** `tests/setup/db.ts`, `playwright.config.ts`, `tests/helpers/actors.ts`, `tests/e2e/_helpers.ts`, `tests/e2e/multi-hospital-config-3a.spec.ts`, `tests/e2e/security-admin.spec.ts`, `tests/integration/{auth,account-security,phase5-1-account-lockout,phase6c-demo-access,phase6e-seed-reproducibility}.test.ts`, `tests/unit/health-route.test.ts`, `tests/component/demo-access.test.tsx`.
- **Edit i18n** `messages/fr.json` + `messages/en.json` (demo-access password placeholder wording).
- **Edit docs** `docs/web-deployment/{00_Web_Deployment_Consolidated_Mentor_Review, 6C_demo_access, Demo_Accounts_and_Access, SanteGrid_Deployment_Runbook}.md`, plus historical `README.md`, `docs/DEMO.md`, `docs/demo/*`, `docs/build-log/*`, `docs/adr/*`, `docs/gate5-evidence/*`, `docs/testing/*` (the former password literal → env-var reference).
- **New docs** this report.

## Schema / migration
**None.** Behavioural + config + docs only. No Prisma model or migration; the only data-layer change is the audit action-code **rename** (`demo.session_started` → `demo.session_requested`).

## Tests added / updated
- **Updated** the demo-access integration test to assert `demo.session_requested` (via `recordDemoSessionRequest`).
- **Updated** all password-using tests to inject the env-controlled synthetic password (no committed literal); removed the now-moot literal-password negative assertions.
- No net count change: **vitest 813** (unit+component 458 + integration 355), **e2e 78** — same as Phase 6 (the corrections are in-place edits).

## QA results (`docs/qa-command-output/web-deployment/6_1/FINAL/`)
`typecheck` clean · `lint` **0/0** · `test` **458** · `test:integration` **355** → **vitest 813** · `build` green · `smoke` GOLDEN PATH · `check:arch` green · `check:privacy` green · `check:i18n` **27** · `check:release` green · `test:e2e` **78** · **0 MISSING_MESSAGE**. Plus `grep-evidence.txt`: the former committed password literal and constant are gone from the code tree; no secrets committed.

## Known issues
- Lab & radiology one-click buttons share the seeded `technicien_diagnostic` account (documented; a finer modality split is a future refinement).
- Residual non-blocking `pg` driver-adapter deprecation warning (unchanged, library-level).

## Deployment-readiness decision
Both pre-deployment blockers are **resolved at the software level, subject to mentor review**. The stakeholder-demo web preparation is otherwise unchanged. **Deployment is still NOT performed** — domain purchase, Neon/Vercel setup, seeding, setting `HMIS_DEMO_SHARED_PASSWORD` + `HMIS_PUBLIC_DEMO_LOGIN_ENABLED=true` in Vercel are **operator actions under a separate, explicit deployment instruction**.

## Boundaries
Synthetic only · not production · not Gate 7 · not real data · no live integrations · not an official government website · not deployed · no domain/Vercel/Neon resources · no real credentials · no `01_`/`02_` changes · **not merged to `main`; not pushed**.
