# Phase 6C — Demo Access and Demo Account Directory

**Batch:** 6C · **Spec:** Doc 43 §7 (+ Doc 42 §4.3, §5) · **Commit message:** `Phase 6C: add demo access and account directory`
**Boundary:** app stays access-controlled · public credentials synthetic only · **passwords never hard-coded/committed** · one-click only if flag-enabled + stakeholder-demo + selected synthetic roles · no real accounts · lockout + RBAC + hospital scoping preserved.

## What was implemented
A **public demo-access page** at `/acces-demo` (no login):
- A **public directory** of the ten synthetic seeded accounts (role + sign-in id + access mode). All `@hrb-demo.cm`.
- **Password handling:** the shared synthetic demo password is **not committed in this surface**; the page shows an operator-provided hint (`NEXT_PUBLIC_DEMO_PASSWORD_HINT`) or a clearly-marked placeholder.
- **Flag-gated one-click login** for the **seven selected roles** (central supervisor, admin, doctor, cashier, pharmacist, lab technician, radiology technician). Sensitive roles (director, validator) + reception / pharmacist-in-charge stay credential-only.
- A synthetic-data warning ("do not enter real data") + the mandatory disclaimers + a CTA to the sign-in page.

## Security model (one-click)
- **Gate:** `canStartOneClickDemo()` = `isStakeholderDemo()` **AND** `isPublicDemoLoginEnabled()`. One-click is refused outside stakeholder-demo mode or with the flag off — **enforced server-side** in `demoLoginAction`, independent of whether the buttons render (a forged POST does nothing).
- **Allow-list:** the role key is resolved against a server-side list of the seven selected roles; a sensitive/unknown key is refused.
- **No client password:** the sign-in uses the seeded synthetic credential **server-side**; it still goes through `authenticateCredentials`, so **F-02 lockout is preserved** (a locked demo account is denied even via one-click).
- **Audit:** each one-click session writes `demo.session_requested` for the synthetic account.

## Files changed
- **New** `app/(public)/acces-demo/page.tsx` (server; reads `canStartOneClickDemo()` + password hint).
- **New** `components/public/demo-account-directory.tsx` + `components/public/demo-login-buttons.tsx` (client).
- **New** `lib/demo-access.ts` — synthetic directory + selected one-click allow-list + `resolveOneClickDemoRole` (NO password).
- **New** `server/auth/demo-actions.ts` — `demoLoginAction` (fail-closed, allow-listed, audited).
- **New** `server/services/demo-service.ts` — `recordDemoSessionStart` (+ barrel export).
- **Edit** `lib/deployment-mode.ts` — `isPublicDemoLoginEnabled()` + `canStartOneClickDemo()`.
- **Edit** `server/services/audit-service.ts` — `demo.session_requested` action. **Edit** `lib/constants/index.ts` — its French label.
- **Edit** `messages/fr.json` + `messages/en.json` — bilingual `demoAccess` namespace. **Edit** `tests/unit/i18n-parity.test.ts`.
- **New tests** `tests/unit/demo-access.test.ts` (4), `tests/component/demo-access.test.tsx` (3), `tests/integration/phase6c-demo-access.test.ts` (4); **Edit** `tests/unit/deployment-mode.test.ts` (+2), `tests/e2e/public-site.spec.ts` (+/acces-demo).
- **New doc** `docs/web-deployment/Demo_Accounts_and_Access.md`.

## Schema / migration
**None.** Reuses the existing user/role models. New audit **action code** only (no schema).

## RBAC / audit
Demo users keep their normal role capabilities; no elevation; central stays aggregate-only. New audit `demo.session_requested` (one-click only). Lockout (F-02), RBAC, and hospital scoping preserved.

## Tests run + results (`docs/qa-command-output/web-deployment/6C/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green · `check:i18n` **26** (+1 `demoAccess`) · `test` **447** (+10) · `test:integration` **352** (+4) · `build` green (`/acces-demo` registered).
- Required behaviours proven: flag off / non-stakeholder-demo → one-click refused (unit `canStartOneClickDemo`; e2e shows the disabled note, no one-click buttons); one-click resolves only synthetic allow-listed accounts (unit + integration); `demo.session_requested` audited (integration); passwords not hard-coded/exposed (unit asserts no password field; component asserts placeholder, never `HMIS_DEMO_SHARED_PASSWORD`); lockout preserved (integration).

## Screenshots / evidence
QA transcripts in `docs/qa-command-output/web-deployment/6C/`. Flag-off vs flag-on screenshots captured in the 6G FINAL pass (flag-off from the standard build; flag-on documented in the runbook).

## Known issues
- Lab and radiology technicians share the seeded `technicien_diagnostic` account (the seeded role does not distinguish modality); both one-click buttons resolve to it. Documented; a finer modality split is a future refinement.
- `NEXT_PUBLIC_DEMO_PASSWORD_HINT` is added to `.env.example` in 6D with the other deployment env vars.

## Boundary confirmation
App stays access-controlled · public credentials synthetic only (`@hrb-demo.cm`) · **passwords never hard-coded/committed** in this surface · one-click only if flag-enabled + stakeholder-demo + selected synthetic roles · no real accounts · lockout + RBAC + hospital scoping preserved · no schema change · no `01_`/`02_` changes · not merged/pushed.
