# Mentor review package — Phase 0 walking skeleton

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Index of the evidence files for external mentor review (Step 14 Testing & QA). All paths
are relative to `03_Software/HMIS_Cameroon/`. A zipped bundle of everything below is at
`docs/mentor-review-package.zip`.

Quick verification: `npm run test:all` (typecheck → lint → unit → component → integration
→ build → e2e) · `npm run smoke:test` · `npm run check:arch` · `npm run check:privacy`.
Tests use a dedicated `TEST_DATABASE_URL` (refuses non-test DB names). Fake data only.

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

## UAT checklist

- [docs/testing/UAT_PHASE_0_WALKING_SKELETON.md](testing/UAT_PHASE_0_WALKING_SKELETON.md)

## QA write-up

- [docs/implementation-notes/STEP_14_TESTING_AND_QA.md](implementation-notes/STEP_14_TESTING_AND_QA.md)

## Screenshots

- [review-screenshots/README.md](review-screenshots/README.md) (index)
- 01 [login](review-screenshots/01-login.png) · 02 [dashboard](review-screenshots/02-dashboard.png) ·
  03 [patient-search](review-screenshots/03-patient-search.png) · 04 [patient-create](review-screenshots/04-patient-create.png) ·
  05 [patient-detail-banner](review-screenshots/05-patient-detail-banner.png) · 06 [encounter](review-screenshots/06-encounter.png) ·
  07 [consultation](review-screenshots/07-consultation.png) · 08 [billing](review-screenshots/08-billing.png) ·
  09 [payment-status](review-screenshots/09-payment-status.png) · 10 [receipt-preview](review-screenshots/10-receipt-preview.png) ·
  11 [audit-log](review-screenshots/11-audit-log.png) · 12 [rbac-denied](review-screenshots/12-rbac-denied.png) ·
  13 [mobile-dashboard](review-screenshots/13-mobile-dashboard.png)
