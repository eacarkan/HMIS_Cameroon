# Phase 6B — Public Feature Showcase

**Batch:** 6B · **Spec:** Doc 43 §6 (+ Doc 42 §4.2, §6) · **Commit message:** `Phase 6B: add public feature showcase`
**Boundary:** public read-only · synthetic · SantéGrid brand · no source/architecture/contract/financial exposure · no real data · no production claim · **no public writes**.

## What was implemented
A **public feature showcase** at `/vitrine` (no login), strong enough for bankers, accountants and non-technical reviewers to verify — without app login — that the application exists, is deployed and contains serious HMIS/EMR functionality:
- **Module preview cards** covering the eleven areas from Doc 42 §6 — patient journey, billing/cashier, pharmacy/stock, laboratory/imaging, emergency, hospitalization, reporting/DHIS2 readiness, insurance/mutuelle, patient-matching/MPI readiness, security/audit/RBAC, and multi-hospital/central oversight. Curated **UI preview cards** (icon + capability summary), not live data.
- A **banker/accountant proof section** ("a real, deployed and verified platform") citing the automated test suite, architecture/privacy guardrails, verified financial flows (atomic payments + account lockout) and the audit trail — **without exposing source code or architecture**.
- A **scope/readiness boundary** (synthetic RC; real-data go-live needs administrative Gate-7 steps) + the mandatory disclaimers + a CTA to demo access.

## Files changed
- **New** `app/(public)/vitrine/page.tsx` — thin server wrapper + metadata.
- **New** `components/public/public-showcase.tsx` — the full showcase body (client, `showcase.*` i18n; reuses `PublicDisclaimers`).
- **Edit** `messages/fr.json` + `messages/en.json` — new bilingual `showcase` namespace (modules + proof + readiness + demo).
- **Edit** `tests/unit/i18n-parity.test.ts` — declared `showcase` bilingual.
- **New test** `tests/component/public-showcase.test.tsx` (3). **Edit** `tests/e2e/public-site.spec.ts` — `/vitrine` assertions (runs in the 6G block).

## Schema / migration
**None.** Curated static/synthetic content only; no data reads, no new models.

## RBAC / audit
**Unchanged.** Public, read-only; no capabilities, no writes, no audit events. Every state-changing workflow stays behind the access-controlled `(app)` group.

## Tests run + results (`docs/qa-command-output/web-deployment/6B/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green (10 demo accounts) · `check:i18n` **25** (was 24; +1 `showcase`) · `test` **437** (was 433; +1 i18n, +3 showcase component test) · `build` green (`/vitrine` registered).
- The showcase component test asserts: modules render, proof + readiness render, **no `<form>` and no submit button** (no public writes), and no patient identifiers.

## Screenshots / evidence
QA transcripts in `docs/qa-command-output/web-deployment/6B/`. Showcase Fr/En screenshots captured in the 6G FINAL pass.

## Known issues
None. (The demo CTA targets `/acces-demo`, added in 6C; its e2e assertion is added with 6C.)

## Boundary confirmation
Public read-only · synthetic · SantéGrid brand · no source/architecture/contract/financial exposure · no real data · no production/Gate-7 claim · **no public writes** (asserted) · no schema change · no `01_`/`02_` changes · not merged/pushed.
