# Phase 2B — Implementation Log — Patient Identity & Outpatient Consultation

**For:** mentor review · **Data:** synthetic / fake only · **Status:** committed (one unit, one commit)
**Branch:** `feature/phase2b-patient-consultation` (stacked on 2A `cce3f89`)
**"Go-live" here = controlled synthetic-data UAT, NOT real operation. Not Gate 7. No real patient data. No production authorization.**

## 1. Objective
Strengthen patient identity (optional phone, **guardian/parent phone**, **estimated age**, **temporary/unidentified-patient** workflow) and tie the **outpatient consultation** to the **configured services** from Phase 2A, plus prepare **ICD-10** diagnosis support. **Patient merge is excluded** (guarded candidate — NOT implemented here).

## 2. Schema / migration decision (additive)
One additive migration `20260629193405_phase2b_patient_identity_diagnosis`: Patient `+guardianPhone, +estimatedAge, +isEstimatedAge, +isTemporaryIdentity, +temporaryIdentifier`; Encounter `+serviceUnitId` (FK → ServiceUnit, `ON DELETE SET NULL`); new GLOBAL `DiagnosisCode` reference (ICD-10 subset). **`dateOfBirth` stays NOT NULL** — when the DOB is unknown, an estimated age derives an approximate birth year (Jan 1) stored in `dateOfBirth` with `isEstimatedAge = true` (avoids a nullable-DOB ripple across Phase 1A code). No drops/renames; Phase 1A intact.

## 3. Files changed
- **Schema/seed:** `prisma/schema.prisma`, `prisma/migrations/20260629193405_…/`, `prisma/seed-data.ts` (ICD-10 subset, ~12 codes, global).
- **Pure lib (new):** `lib/patient-identity.ts` (`validateAgeInput` DOB-xor-estimated, `approxBirthYear`/`estimatedBirthDate`, `temporaryIdentifierFor`/`temporaryIdDayPrefix`).
- **Data-access:** `server/db/patients.ts` (+identity fields, `updatePatient`, `countTemporaryPatientsForDay`), `server/db/diagnosis-codes.ts` (new), `server/db/config.ts` (`findActiveServiceUnitByLabel`), `server/db/encounters.ts` (`serviceUnitId`), `server/db/index.ts`.
- **Services:** `server/services/patient-service.ts` (estimated-age in create, `createTemporaryPatient`, `correctPatientIdentity`), `server/services/encounter-service.ts` (resolve `serviceUnitId` from the configured label), `server/services/clinical-structure-service.ts` (`listDiagnosisCodes`), `server/services/audit-service.ts` (+2 actions), `lib/constants/index.ts` (+labels), `server/services/index.ts`.
- **Actions/UI:** `server/actions/patient-actions.ts` (estimated age + guardian phone; `createTemporaryPatientAction`, `correctPatientIdentityAction`), `components/patients/patient-form.tsx`, `components/patients/temporary-patient-form.tsx` (new), `components/patients/identity-correction-form.tsx` (new), `app/(app)/patients/temporaire/page.tsx` (new), `app/(app)/patients/page.tsx`, `app/(app)/patients/[id]/page.tsx`, `components/consultations/clinical-structure-panel.tsx` (ICD-10 datalist), `app/(app)/encounters/[id]/page.tsx`.
- **i18n:** `messages/fr.json` + `messages/en.json` (new patient keys).
- **Tests (new):** unit `patient-identity`, integration `patient-identity-2b`, component `patient-identity-2b`, e2e `patients-identity-2b`.

## 4. Services / behaviour
- **Registration:** DOB **or** estimated age (mutually exclusive, validated); optional phone + guardian phone.
- **Temporary patient:** explicit workflow → `Inconnu_YYMMDD_NN` (per hospital + day), `isTemporaryIdentity`, original `temporaryIdentifier` retained; a normal patient number is still allocated.
- **Identity correction:** confirms identity, clears the temporary flag, **never changes the original temporary ID**, and the audit event **retains that original temp ID forever**.
- **Consultation ↔ service:** opening a visit resolves the chosen label to an active `ServiceUnit` (`serviceUnitId`); the free-text label is kept for back-compat.
- **ICD-10:** `listDiagnosisCodes` exposes the configurable subset; the existing diagnosis recorder picks a code via a datalist.

## 5. RBAC / audit
Reception registers + creates temporary patients (`patient.create`) and corrects identity (`patient.identity.manage`); doctor keeps clinical + view-only identity; **admin has no clinical/identity data entry** (Phase 2A de-scope). New append-only audit actions `patient.temporary_created`, `patient.identity_updated` (French labels); a recorded diagnosis reuses `diagnosis.create`.

## 6. Tests run + results (cumulative)
typecheck ✓ · lint ✓ · build ✓ · unit + component **133** · integration **99** · e2e **21** · smoke **GOLDEN PATH** ✓ · arch ✓ · privacy ✓.

## 7. Known issues / notes
- Temporary patients carry an unknown-DOB sentinel (1900-01-01) unless an estimated age is given; identity correction sets the real DOB/estimated age.
- The encounter↔service link is best-effort by label match (the seeded "Médecine générale" resolves; unmatched free text leaves `serviceUnitId` null — non-breaking).
- ICD-10 is a small UAT subset; importing the full catalogue is a documented extension path (not done).
- **Adversarially reviewed (5 dimensions).** Fixes applied: `updatePatient` now enforces hospital scoping at the DB layer (`where: { id, hospitalId }`, BLOCKER); `assignEncounterService` re-resolves the configured-service link on re-assignment (MAJOR); identity correction now includes `residence`; the diagnosis picker is locale-aware (Fr/En). The "incomplete `en.json`" review findings were **false positives** — `i18n/request.ts` overlays English on a French base, so untranslated keys fall back to French (intended progressive-i18n design; the app is not retranslated wholesale). The two new forms (temporary patient, identity correction) redirect on success and don't echo inputs on a (rare) validation error — noted minor, not fixed.

## 8. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real-data/production authorization · **patient MERGE excluded (guarded candidate — NOT implemented)** · warning-only duplicates (Phase 1A binding preserved) · **no prescription / pharmacy / emergency / hospitalization / lab-radiology** · additive schema only · hospital-scoped · bilingual Fr/En keys · contract/admin folders untouched. **"Go-live" = controlled synthetic-data UAT, not real operation.**
