# Phase 1A — Files for Mentor Review

**Project:** MINSANTE SIGH/DME · **Branch:** feature/gate4-ui-workflows (tip 212fd0c) · **Baseline:** Gate 6 (b48b294)
**Total files changed/added in Phase 1A:** 125 · Fake/demo data only.

Start with **docs/phase1a-implementation-logs/00_PHASE_1A_SUMMARY.md**, then the per-batch BATCH_*.md logs.


## Summary & per-batch logs
- docs/phase1a-implementation-logs/00_PHASE_1A_SUMMARY.md
- docs/phase1a-implementation-logs/BATCH_1A_PATIENT_IDENTITY.md
- docs/phase1a-implementation-logs/BATCH_1B_ENCOUNTER_LIFECYCLE.md
- docs/phase1a-implementation-logs/BATCH_2_CLINICAL_DOCUMENTATION.md
- docs/phase1a-implementation-logs/BATCH_3_BILLING_CASHIER.md
- docs/phase1a-implementation-logs/BATCH_4_ADMIN_SECURITY.md
- docs/phase1a-implementation-logs/BATCH_5_DASHBOARDS_REPORTING.md
- docs/phase1a-implementation-logs/BATCH_6_PILOT_READINESS.md

## Pure libraries (lib/)
- lib/account-security.ts
- lib/billing-rules.ts
- lib/constants/index.ts
- lib/consultation-status.ts
- lib/dashboard-metrics.ts
- lib/data-mode.ts
- lib/encounter-status.ts
- lib/env-validation.ts
- lib/password-policy.ts
- lib/patient-matching.ts
- lib/patient-timeline.ts

## Data-access (server/db/)
- server/db/audit.ts
- server/db/consultations.ts
- server/db/dashboard.ts
- server/db/encounters.ts
- server/db/index.ts
- server/db/invoices.ts
- server/db/patients.ts
- server/db/users.ts

## Services (server/services/)
- server/services/audit-service.ts
- server/services/auth-service.ts
- server/services/billing-service.ts
- server/services/consultation-service.ts
- server/services/dashboard-service.ts
- server/services/encounter-service.ts
- server/services/index.ts
- server/services/patient-service.ts
- server/services/receipt-service.ts
- server/services/reports-service.ts
- server/services/system-service.ts
- server/services/user-admin-service.ts

## Server actions (server/actions/)
- server/actions/account-actions.ts
- server/actions/billing-actions.ts
- server/actions/consultation-actions.ts
- server/actions/encounter-actions.ts
- server/actions/patient-actions.ts

## UI components (components/)
- components/account/change-password-form.tsx
- components/billing/cashier-controls.tsx
- components/consultations/consultation-controls.tsx
- components/consultations/consultation-form.tsx
- components/dashboard/dashboard-kpis.tsx
- components/encounters/encounter-lifecycle.tsx
- components/layout/nav.ts
- components/patients/duplicate-warning.tsx
- components/patients/patient-form.tsx
- components/patients/patient-search-form.tsx
- components/patients/patient-timeline.tsx
- components/print/consultation-note-document.tsx
- components/print/consultation-note-view.tsx
- components/print/receipt-document.tsx

## Pages / routes (app/)
- app/(app)/administration/utilisateurs/page.tsx
- app/(app)/consultations/[id]/page.tsx
- app/(app)/encounters/[id]/page.tsx
- app/(app)/error.tsx
- app/(app)/etat-systeme/page.tsx
- app/(app)/factures/[id]/page.tsx
- app/(app)/journal-audit/[id]/page.tsx
- app/(app)/journal-audit/page.tsx
- app/(app)/mon-compte/page.tsx
- app/(app)/patients/[id]/page.tsx
- app/(app)/patients/page.tsx
- app/(app)/rapports-caisse/export/route.ts
- app/(app)/rapports-caisse/page.tsx
- app/(app)/recus/[id]/page.tsx

## i18n / config / scripts / seed
- messages/fr.json
- prisma/seed-data.ts
- scripts/check-architecture.ts
- scripts/check-privacy.ts
- server/auth/config.ts

## Tests — unit
- tests/unit/account-security.test.ts
- tests/unit/billing-rules.test.ts
- tests/unit/consultation-status.test.ts
- tests/unit/dashboard-metrics.test.ts
- tests/unit/data-mode.test.ts
- tests/unit/encounter-status.test.ts
- tests/unit/patient-matching.test.ts
- tests/unit/patient-timeline.test.ts

## Tests — component
- tests/component/account-forms.test.tsx
- tests/component/app-error.test.tsx
- tests/component/cashier-controls.test.tsx
- tests/component/consultation-note.test.tsx
- tests/component/dashboard-kpis.test.tsx
- tests/component/encounter-lifecycle.test.tsx
- tests/component/patient-search-duplicate.test.tsx

## Tests — integration
- tests/integration/account-security.test.ts
- tests/integration/billing.test.ts
- tests/integration/consultation.test.ts
- tests/integration/dashboard.test.ts
- tests/integration/encounter.test.ts
- tests/integration/gate5b-reports-users.test.ts
- tests/integration/patient.test.ts
- tests/integration/system-status.test.ts

## Tests — e2e
- tests/e2e/lifecycle-encounter.spec.ts
- tests/e2e/note-clinical.spec.ts
- tests/e2e/patient-duplicate.spec.ts
- tests/e2e/security-admin.spec.ts
- tests/e2e/shift-cashier.spec.ts
- tests/e2e/views-dashboard.spec.ts
- tests/e2e/views-system.spec.ts

## Screenshots (fake data)
- docs/batch1a-screenshots/01-recherche-filtres.png
- docs/batch1a-screenshots/02-avertissement-doublon.png
- docs/batch1a-screenshots/03-journal-audit-doublon.png
- docs/batch1b-screenshots/01-timeline.png
- docs/batch1b-screenshots/02-lifecycle-controls.png
- docs/batch1b-screenshots/03-status-history.png
- docs/batch2-screenshots/01-note-summary.png
- docs/batch2-screenshots/02-finalized-note.png
- docs/batch2-screenshots/03-amended-history.png
- docs/batch3-screenshots/01-report-by-method.png
- docs/batch3-screenshots/02-shift-closed.png
- docs/batch3-screenshots/03-voided-invoice.png
- docs/batch4-screenshots/01-change-password.png
- docs/batch4-screenshots/02-audit-detail.png
- docs/batch5-screenshots/01-cashier-dashboard.png
- docs/batch5-screenshots/02-reception-dashboard.png
- docs/batch6-screenshots/01-system-status.png
