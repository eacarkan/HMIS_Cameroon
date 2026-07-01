# Phase 1A — Batch 1A Implementation Log — Patient identity strengthening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed)
**Branch:** `feature/phase1a-batch-1a-patient-identity` · **Commit:** `726b52b` (parent `b48b294` Gate 6)

## 1. Objective
Make patient lookup and duplicate awareness safer at registration — **without ever deciding identity automatically** (no merge, no block).

## 2. Schema / migration decision
**No schema change, no migration.** Reuses existing `Patient` (incl. `phone`) and the `Patient.identifiers` relation. The duplicate detector is a pure library over existing rows.

## 3. Files changed
- **New:** `lib/patient-matching.ts` (pure classifier), `components/patients/patient-search-form.tsx`, `components/patients/duplicate-warning.tsx`, tests (`tests/unit/patient-matching.test.ts`, `tests/component/patient-search-duplicate.test.tsx`, `tests/e2e/patient-duplicate.spec.ts`), `docs/batch1a-screenshots/`.
- **Modified:** `server/db/patients.ts` (+`searchPatientsAdvanced`, `findPotentialDuplicatePatients`), `server/db/index.ts`, `server/services/patient-service.ts` (+`findPatientDuplicatesForActor`, filters on `searchPatientsForActor`, override audit on `createPatientForActor`), `server/services/index.ts`, `server/actions/patient-actions.ts`, `components/patients/patient-form.tsx`, `app/(app)/patients/page.tsx`, `messages/fr.json`, `tests/integration/patient.test.ts`.

## 4. Services changed
Structured search (name / patient-number / phone / identifier / sex); conservative duplicate detection (exact normalized name+DOB, or exact phone), WARNING-ONLY; create records a `patient_duplicate.warning` audit when the user proceeds past a warning.

## 5. UI changed
Patient list: structured search form. Registration: amber duplicate warning listing candidates with "Ouvrir" links; primary button morphs to "Créer quand même". No merge control anywhere.

## 6. RBAC changes
None added — reuses `patient.read` / `patient.create`. All new queries hospital-scoped.

## 7. Audit changes
`patient_duplicate.warning` ("Doublon signalé") recorded on override, referencing matched candidate(s).

## 8. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **55**; integration **62** (+7); e2e **11** (+3); smoke GOLDEN PATH PASSED; check:arch ✓; check:privacy ✓. Verified in test DB: override created a 2nd record (no merge) + 1 warning audit.

## 9. Screenshots (fake data)
`docs/batch1a-screenshots/`: `01-recherche-filtres.png`, `02-avertissement-doublon.png`, `03-journal-audit-doublon.png`.

## 10. Known issues / notes
React 19 auto-resets `<form action>` after the action; the warn→confirm flow uses the previous action state + a form `key` remount so values (incl. the sex `<select>`) survive. Phone match is exact-on-digits (conservative). Identifier search is hospital-local.

## 11. Boundaries respected
Fake data only; no real-data/production authorization; no merge/delete of patients; no Phase 2 module; no schema/migration; layering + arch/privacy guardrails intact; contract/admin folders untouched.
