# Phase 6A — Public Landing Page and SantéGrid Branding

**Batch:** 6A · **Spec:** Doc 43 §5 · **Commit message:** `Phase 6A: add public landing page and SantéGrid branding`
**Boundary:** synthetic-demo only · not production · not Gate 7 · not real data · no live integrations · **not an official government website** · brand = **SantéGrid** (no MINSANTE in domain/brand).

## What was implemented
A **public landing page** at `/accueil` (no login) under the **SantéGrid** brand, rendered by a new `app/(public)/` route group with its own layout (no auth guard, no app shell) that reuses the mandatory prototype banner. The page carries the verbatim positioning line, the two mandatory disclaimers (synthetic-demonstration + "not an official government website / not Gate 7 / not production"), a capabilities overview, and calls-to-action to the feature showcase (`/vitrine`, 6B) and demo access (`/acces-demo`, 6C) plus sign-in (`/connexion`).

**Front door (flag-gated).** The authenticated layout now sends an unauthenticated visitor to the public landing **only** when `HMIS_PUBLIC_SITE_ENABLED=true` (the stakeholder-demo deployment); with the flag unset/false the existing `/connexion` behaviour is unchanged, so all current tests and the golden path are unaffected.

## Files changed
- **New** `app/(public)/layout.tsx` — public route-group layout (banner + header + footer; no auth).
- **New** `app/(public)/accueil/page.tsx` — the landing page (server component; static/synthetic).
- **New** `components/public/santegrid-logo.tsx` — SantéGrid wordmark (placeholder brand mark).
- **New** `components/public/public-header.tsx` — public nav (features / demo / sign-in) + language toggle.
- **New** `components/public/public-footer.tsx` — brand + boundary restatement (incl. not-official-government).
- **New** `components/public/public-disclaimers.tsx` — the two mandatory disclaimers (i18n-driven).
- **New** `lib/deployment-mode.ts` — fail-closed flags `DEPLOYMENT_ENVIRONMENT`, `isStakeholderDemo()`, `isPublicSiteEnabled()`.
- **Edit** `app/(app)/layout.tsx` — flag-gated unauth front-door redirect (`/accueil` when the public site is enabled).
- **Edit** `messages/fr.json` + `messages/en.json` — new bilingual `publicSite` + `landing` namespaces.
- **Edit** `tests/unit/i18n-parity.test.ts` — declared `publicSite` + `landing` bilingual.
- **New tests** `tests/unit/deployment-mode.test.ts` (3), `tests/component/public-branding.test.tsx` (4), `tests/e2e/public-site.spec.ts` (landing; runs in the 6G full block).

## Schema / migration
**None.** Static/public content and flag helpers only. No new models; no Prisma change.

## RBAC / audit
**Unchanged.** The public route group has no auth guard and reads no operational data; it grants no capabilities. All app workflows remain access-controlled behind the `(app)` group. No new audit events.

## Tests run + results (`docs/qa-command-output/web-deployment/6A/`)
- `typecheck` clean · `lint` **0/0** · `check:arch` green · `check:privacy` green (10 demo accounts `@hrb-demo.cm`) · `check:i18n` **24** (was 22; +2 for the new bilingual namespaces) · `test` (unit+component) **433** (was 424; +2 i18n, +3 deployment-mode, +4 branding) · `build` green (`/accueil` route registered).

## Screenshots / evidence
QA transcripts saved to `docs/qa-command-output/web-deployment/6A/`. Fr + En landing screenshots are captured in the consolidated 6G FINAL pass (single Playwright capture across all public pages) and indexed there.

## Known issues
- The header links to `/vitrine` (6B) and `/acces-demo` (6C), which are added in the following batches; the e2e assertions for those routes are added with them (the e2e block runs at 6G).

## Boundary confirmation
Public + synthetic · no government-ownership wording · no MINSANTE in domain/brand · **"not an official government website"** disclaimer present · no private/operational data on the public page · app stays access-controlled · brand = SantéGrid · no schema change · no `01_`/`02_` changes · not merged/pushed.
