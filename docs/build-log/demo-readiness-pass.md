# Correction pass — Phase 0 demo-readiness

Date: 2026-06-27 · Scope: docs + dev/QA tooling + small French/login polish (no new modules).

## Changes

1. **Two screenshot sets.** Separated the *technical review* set (`docs/review-screenshots/`,
   two patients, empty forms shown, 15 shots) from the approved *stakeholder demo*
   (`docs/stakeholder-demo-screenshots/`, one patient → dashboard **1 / 1 / 3 000 FCFA**,
   9 shots) per `Planning/07_Demo_Scenario_and_Fake_Dataset.md`. New `npm run screenshots:demo`;
   the capture pipeline is parameterised (`REVIEW_SET`, `OUTDIR`, `SHOW_DEMO`, `ONE_PATIENT`).
2. **Logout E2E** — `tests/e2e/logout.spec.ts` (login → user menu → « Déconnexion » →
   `/connexion`). Executed UAT case 16 is now **Pass** (was Not executed).
3. **Mobile caveat** — executed UAT case 17 is now **Pass with caveat**: narrow layout
   stacks correctly, but no mobile navigation/drawer is implemented yet.
4. **Full receipt evidence** — added `…/08-recu-complet.png` (stakeholder) and
   `review-screenshots/15-receipt-full.png` (tall viewport → entire receipt incl.
   signature/footer/prototype note).
5. **Demo-accounts hint hidden by default** — `app/connexion/page.tsx` now gates the
   demo-accounts + password hint behind `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS` (default off, so
   stakeholder screenshots show no password). Seed data unchanged.
6. **French polish** — sidebar section label `Navigation` → `Menu`; top-bar sign-out
   `Se déconnecter` → `Déconnexion`.

## Product code touched (minimal, requested)

`messages/fr.json` (two labels), `app/connexion/page.tsx` (env-gated hint),
`.env.example` (new flag). No new modules, routes, or business logic.

## QA (all green)

typecheck · lint · build · test (33) · test:integration (26) · **test:e2e (8, incl. logout)** ·
smoke:test · check:arch · check:privacy — all exit 0. Outputs in `docs/qa-command-output/`.
