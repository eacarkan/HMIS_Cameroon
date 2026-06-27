# Mentor review package — Phase 0 walking skeleton

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Index of the evidence files for external mentor review (Step 14 Testing & QA). All paths
are relative to `03_Software/HMIS_Cameroon/`. A zipped bundle of everything below is at
`docs/mentor-review-package.zip`.

Quick verification: `npm run test:all` (typecheck → lint → unit → component → integration
→ build → e2e) · `npm run smoke:test` · `npm run check:arch` · `npm run check:privacy`.
Tests use a dedicated `TEST_DATABASE_URL` (refuses non-test DB names). Fake data only.
Captured command outputs are in [docs/qa-command-output/](qa-command-output/) (9 files,
all exit 0). Review screenshots are recaptured in **production mode** (no dev overlay)
and machine-validated (no 404 / prototype label present): `npm run screenshots:review`.

## Package / config

- [package.json](../package.json)
- [next.config.ts](../next.config.ts)
- [tsconfig.json](../tsconfig.json)
- [vitest.config.ts](../vitest.config.ts)
- [playwright.config.ts](../playwright.config.ts)
- [components.json](../components.json)
- [.env.example](../.env.example)
- [tests/setup/db.ts](../tests/setup/db.ts)
- [tests/setup/rtl.ts](../tests/setup/rtl.ts)

## Key implementation files

UI / pages / components:
- [app/layout.tsx](../app/layout.tsx) — root layout
- [app/(app)/layout.tsx](<../app/(app)/layout.tsx>) — authenticated shell layout (guards)
- [components/layout/app-shell.tsx](../components/layout/app-shell.tsx)
- [components/layout/sidebar.tsx](../components/layout/sidebar.tsx)
- [components/layout/topbar.tsx](../components/layout/topbar.tsx)
- [components/layout/prototype-banner.tsx](../components/layout/prototype-banner.tsx)
- [app/selection-hopital/page.tsx](../app/selection-hopital/page.tsx) — hospital selector
- [components/patients/patient-banner.tsx](../components/patients/patient-banner.tsx)
- [app/(app)/patients/page.tsx](<../app/(app)/patients/page.tsx>) — search/list
- [app/(app)/patients/nouveau/page.tsx](<../app/(app)/patients/nouveau/page.tsx>) — create page
- [components/patients/patient-form.tsx](../components/patients/patient-form.tsx)
- [app/(app)/patients/[id]/page.tsx](<../app/(app)/patients/[id]/page.tsx>) — detail
- [app/(app)/encounters/[id]/page.tsx](<../app/(app)/encounters/[id]/page.tsx>) — encounter
- [app/(app)/encounters/[id]/consultation/nouvelle/page.tsx](<../app/(app)/encounters/[id]/consultation/nouvelle/page.tsx>)
- [app/(app)/encounters/[id]/facturation/page.tsx](<../app/(app)/encounters/[id]/facturation/page.tsx>)
- [app/(app)/factures/[id]/page.tsx](<../app/(app)/factures/[id]/page.tsx>) — invoice/payment
- [components/print/receipt-document.tsx](../components/print/receipt-document.tsx)
- [app/(app)/recus/[id]/page.tsx](<../app/(app)/recus/[id]/page.tsx>) — receipt
- [features/dashboard/dashboard-overview.tsx](../features/dashboard/dashboard-overview.tsx)
- [app/(app)/page.tsx](<../app/(app)/page.tsx>) — dashboard page
- [app/(app)/journal-audit/page.tsx](<../app/(app)/journal-audit/page.tsx>) — audit log

One representative file per layer (boundary proof: action → service → data-access):
- [server/actions/patient-actions.ts](../server/actions/patient-actions.ts) — transport (validate, delegate)
- [server/services/patient-service.ts](../server/services/patient-service.ts) — business logic (authorize, scope, audit)
- [server/db/patients.ts](../server/db/patients.ts) — hospital-scoped data-access (only place Prisma runs)

## Key test files

- [tests/unit/money.test.ts](../tests/unit/money.test.ts)
- [tests/integration/billing.test.ts](../tests/integration/billing.test.ts)
- [tests/component/sidebar.test.tsx](../tests/component/sidebar.test.tsx)
- [tests/e2e/golden-path.spec.ts](../tests/e2e/golden-path.spec.ts)
- [scripts/golden-path.ts](../scripts/golden-path.ts)
- [scripts/check-architecture.ts](../scripts/check-architecture.ts)
- [scripts/check-privacy.ts](../scripts/check-privacy.ts)

## Screenshot capture (deterministic + self-validating)

- [scripts/capture-review-screenshots.sh](../scripts/capture-review-screenshots.sh) — orchestrator: prod build + server on test DB → seed → capture
- [scripts/seed-review-fixture.ts](../scripts/seed-review-fixture.ts) — deterministic golden-path fixture; emits the real route IDs
- [scripts/capture-review-screenshots.mjs](../scripts/capture-review-screenshots.mjs) — captures + **refuses to save** any 404 / label-missing / empty page

## QA command outputs

- [docs/qa-command-output/](qa-command-output/) — actual output of the 9 commands
  (`typecheck`, `lint`, `build`, `test`, `test-integration`, `test-e2e`, `smoke-test`,
  `check-arch`, `check-privacy`), paths redacted, all exit 0.

## UAT checklist

- [docs/testing/UAT_PHASE_0_WALKING_SKELETON.md](testing/UAT_PHASE_0_WALKING_SKELETON.md) — blank template
- [docs/testing/UAT_PHASE_0_WALKING_SKELETON_EXECUTED.md](testing/UAT_PHASE_0_WALKING_SKELETON_EXECUTED.md) — executed (Pass / Not executed)

## QA write-up

- [docs/implementation-notes/STEP_14_TESTING_AND_QA.md](implementation-notes/STEP_14_TESTING_AND_QA.md)

## Screenshots

Production mode (no dev overlay), machine-validated (no 404, prototype label present),
fake data only — see [review-screenshots/README.md](review-screenshots/README.md).

- 01 [login](review-screenshots/01-login.png) · 02 [dashboard](review-screenshots/02-dashboard.png) ·
  03 [patient-search](review-screenshots/03-patient-search.png) · 04 [patient-create](review-screenshots/04-patient-create.png) ·
  05 [patient-detail-banner](review-screenshots/05-patient-detail-banner.png) · 06 [encounter](review-screenshots/06-encounter.png) ·
  07 [consultation](review-screenshots/07-consultation.png) · 08 [billing](review-screenshots/08-billing.png) ·
  09 [payment-status](review-screenshots/09-payment-status.png) · 10 [receipt-preview](review-screenshots/10-receipt-preview.png) ·
  11 [audit-log](review-screenshots/11-audit-log.png) · 12 [rbac-denied](review-screenshots/12-rbac-denied.png) ·
  13 [mobile-dashboard](review-screenshots/13-mobile-dashboard.png) · 14 [rbac-audit-denied](review-screenshots/14-rbac-audit-denied.png)
