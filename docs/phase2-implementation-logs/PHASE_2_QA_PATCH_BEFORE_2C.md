# Phase 2 — QA Patch (before Phase 2C)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2-qa-before-2c` (stacked on 2B `6036b07`)
**This is NOT Phase 2C.** No billing/cashier/refund, pharmacy/prescription, queue, hospitalization, emergency, lab/radiology, DHIS2, offline, or real-data work.

## 1. Objective
Apply the mentor-required QA fixes to Phase 2A/2B so Phase 2C can start: restrict the outpatient visit service picker to *outpatient consultation* services, prove the exclusion with tests, harden DOB validation, and refresh the QA command-output evidence.

## 2. Mentor findings addressed
1. **Outpatient service picker too broad** — the new-visit form consumed the *full* active catalogue, exposing support/cashier/pharmacy/lab/imaging/inpatient services. Now restricted to active **OUTPATIENT** services that **accept consultation**.
2. **Missing proof** — added unit + integration + e2e tests proving non-outpatient/support services do not appear.
3. **Stale QA evidence** — regenerated all nine `docs/qa-command-output/*.txt` to match the current totals.
4. **DOB validation (recommended)** — added server-side checks: a provided DOB must parse, not be in the future, and not imply an age > 130y. Estimated-age path unchanged; `dateOfBirth` stays NOT NULL.

## 3. Files changed
- **Restricted read path:** `lib/service-catalogue.ts` (new pure `isOutpatientConsultationService`), `server/db/config.ts` (`listActiveOutpatientConsultationServices` — `hospitalId + deletedAt:null + isActive + type=OUTPATIENT + acceptsConsultation`), `server/db/index.ts`, `server/services/config-service.ts` (`listActiveOutpatientConsultationServices`, `service.config.view`), `server/services/index.ts`, `app/(app)/patients/[id]/visite/nouvelle/page.tsx` (uses the restricted picker; safe fallback only when none configured).
- **DOB hardening:** `lib/patient-identity.ts` (`validateAgeInput(input, now?)` — parse/future/>130y), `server/actions/patient-actions.ts` (passes `new Date()`).
- **Tests:** `tests/unit/service-catalogue.test.ts` (+predicate), `tests/unit/patient-identity.test.ts` (+DOB), `tests/integration/outpatient-services-2qa.test.ts` (new), `tests/e2e/visit-services-2qa.spec.ts` (new).
- **Evidence:** `docs/qa-command-output/*.txt` (refreshed). **Log:** this file.
- **No schema change, no migration.**

## 4. Behavior changed (exact)
The outpatient new-visit service selector (`/patients/[id]/visite/nouvelle` → `EncounterForm`) is now sourced from **`listActiveOutpatientConsultationServices`** instead of `listActiveServices`. It returns only services where `hospitalId = current`, `deletedAt = null`, `isActive = true`, `type = OUTPATIENT`, `acceptsConsultation = true`. Result for the Bertoua seed: Médecine générale, Pédiatrie, Gynéco-obstétrique, Chirurgie, Dentaire. **Excluded:** Reception, Cashier, Pharmacy, Laboratory, Medical Imaging, inpatient wards, inactive services, other hospitals, and active services that do not accept consultation. The built-in fallback list is used **only** when no outpatient consultation service is configured; it never overrides a valid configured catalogue. Hospital scoping is enforced at the service layer (`service.config.view`) **and** the DB `where` clause. The golden path is unaffected (Médecine générale remains the default).

## 5. DOB validation change
`validateAgeInput` now also validates a provided DOB (when `now` is passed): rejects an unparseable date, a future date, and a date implying age > 130y. Estimated age remains mutually exclusive with DOB and bounded 0–130. No nullable `dateOfBirth`.

## 6. Tests added/updated + results
- **Unit:** `isOutpatientConsultationService` (outpatient-accepts-consultation true; support/inpatient/inactive/no-consultation false); `validateAgeInput` DOB hardening (invalid/future/too-old rejected; valid accepted; estimated path intact).
- **Integration (`outpatient-services-2qa`):** returns only active outpatient consultation services; excludes Cashier/Pharmacy/Lab/Imaging/Reception + inpatient wards; excludes a deactivated outpatient service; excludes cross-hospital; denies an actor without `service.config.view`.
- **E2E (`visit-services-2qa`):** the new-visit form lists outpatient services and does **not** list Caisse/Pharmacie/Laboratoire/Imagerie médicale/Accueil/Maternité.

**Results (cumulative):** typecheck ✓ · lint ✓ · build ✓ · unit + component **137** · integration **104** · e2e **22** · smoke **GOLDEN PATH** ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real patient data · no production authorization · **no Phase 2C billing/cashier/refund** · no pharmacy/prescription · no queue · no hospitalization · no emergency · no lab/radiology · no DHIS2/Mobile Money/external payment/offline · no schema change/migration · `01_Administratif_et_Contrat/**` and `02_Package_Contractuel_Final/**` untouched. **"Go-live" = controlled synthetic-data UAT, not real operation.**

## 8. Known issues
None outstanding. (The temporary-patient + identity-correction forms still redirect on success and don't echo inputs on a rare validation error — noted in the 2B log; out of scope here.)

## 9. Confirmation
**Phase 2C was NOT implemented.** No billing/cashier/refund, pharmacy/prescription, queue, hospitalization, emergency, lab/radiology, or integration code was added — only the mentor-required QA fixes above.
