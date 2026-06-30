# Phase 3F-5 — Identity / DOB / Temporary-Patient Numbering Hardening (NEW)

**Unit:** 3F-5 · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3F-5: harden identity/DOB parsing and temporary-patient numbering`

> A **new** build (not a verify-only unit) — the medium-priority identity edge cases from the Phase 2 backlog (doc 34 §13). Synthetic data only.

## 1. Objective
Harden identity edge cases before real-data pilot: strict `YYYY-MM-DD` DOB parsing (reject invalid / non-format / future / age > 130), estimated-age path preserved, **concurrency-safe** temporary-patient numbering, validation-error UX that preserves user input, and an audit trail for rejected DOBs — with **no automatic patient merge** (doc 34 §13).

## 2. Commit
`Phase 3F-5: harden identity/DOB parsing and temporary-patient numbering`.

## 3. Verification against doc 34 §13.14 (required tests)
| doc 34 §13.14 requirement | Coverage |
|---|---|
| Invalid date string **rejected** | ✅ unit (`validateAgeInput` / `parseStrictDob`) |
| Non-`YYYY-MM-DD` **rejected** | ✅ unit (`"1990"`, `"05/05/1990"`, `"1990-5-5"`, …) |
| Future DOB **rejected** | ✅ unit |
| Too-old (>130y) DOB **rejected** | ✅ unit (UTC-stable age) |
| Estimated-age path **still works** | ✅ unit + integration (temporary patient with `estimatedAge`) |
| **Concurrent** temporary-patient creation yields **unique IDs** | ✅ integration (6 concurrent creates → 6 distinct `Inconnu_YYMMDD_NN`) |
| Validation error **preserves user input** | ✅ action returns `values`; the patient form repopulates from `state.values` (shared mechanism) |
| Audit **retains original temporary ID** | ✅ integration (`patient.identity_updated` summary contains the original temp ID; the ID is never changed) |
| New: rejected DOB **auditable** | ✅ `patient.dob_validation_failed` (integration) |

## 4. Schema summary (additive; stop-and-propose → proceed)
**Decision:** propose-in-report + proceed (additive, anticipated by §13.4). One additive **partial unique index** — no model/column change:
- `Patient_temporary_identifier_unique` on `Patient ("hospitalId","temporaryIdentifier") WHERE "temporaryIdentifier" IS NOT NULL` — guarantees temporary identifiers are unique per hospital so concurrent creation cannot mint duplicates. A partial unique index is not expressible in `schema.prisma`, so (like the cashier-shift index) it lives in migration `20260630180000_temp_patient_unique` and is mirrored in `scripts/setup-test-db.ts` for the db-push test env.

## 5. RBAC / audit summary
No new capability (`patient.create`, `patient.identity.manage` as before; hospital-scoped, per-hospital via 3A/3B). New audit `patient.dob_validation_failed` (recorded by the service helper `auditDobValidationFailure`, called from the create + identity-correction actions on a rejected DOB). `patient.temporary_created` / `patient.identity_updated` unchanged (the latter still retains the original temporary ID forever).

## 6. Implementation
- `lib/patient-identity.ts` — new `parseStrictDob` (strict `YYYY-MM-DD`, round-trip-checked so impossible dates like `2020-02-30` are rejected with no silent normalisation) + UTC-stable age; `validateAgeInput` now uses it. The future-DOB guard compares at **calendar-day granularity with a one-day timezone grace** (a UTC-midnight DOB vs an absolute `now`), so a newborn's DOB = today is accepted even just after local midnight in a UTC+ timezone (WAT). New pure `parseTemporarySeq` / `nextTemporarySeq` (MAX-suffix-based) helpers. Estimated-age branch untouched.
- `server/services/patient-service.ts` — `createTemporaryPatient` wraps numbering in a **P2002 retry loop** using **`MAX(suffix)+1`** (`nextTemporarySeq` over `listTemporaryIdentifiersForDay`) — gap-tolerant, so a future deletion/void can never reproduce a taken number; under concurrency the winner has committed by the retry, so the next `NN` is free (mirrors the 2F queue-ticket pattern). New `auditDobValidationFailure` service helper.
- `server/actions/patient-actions.ts` — on a rejected DOB, audit the failure **and** echo `values` so the form repopulates (input preserved).

### Adversarial review hardening (pre-commit)
A focused 2-dimension Workflow (temp-numbering concurrency + strict-DOB soundness, each verified) returned **2 confirmed (minor) findings, both fixed here**: (1) the future-DOB check used an instant comparison that wrongly rejected a DOB = today during the 00:00–00:59 WAT window → now a calendar-day comparison with a one-day grace (regression test added); (2) temporary numbering used `count+1`, which a future suffix gap could wedge → now `MAX(suffix)+1`, truly mirroring the queue-ticket pattern (gap-tolerant; unit test added). Two other candidates were refuted as not-a-bug.

## 7. Test evidence
[`docs/qa-command-output/3F-5/`](../qa-command-output/3F-5/). `tsc`/`eslint`/`check:arch`/`check:privacy`/`smoke` clean; targeted **11 passed** (5 unit + 4 strict-DOB + integration); `test:integration` **271 passed**. Vitest total **591** (320 + 271). e2e unchanged at **43** (the patient form repopulation uses the pre-existing `state.values` mechanism; no e2e-visible flow changed).

## 8. Known issues
- **No automatic patient merge** (explicitly out of scope, §13.5) — patient merge remains a guarded, warning-only candidate.
- The unknown-DOB temporary record keeps the `1900-01-01` UTC sentinel (estimated-age is the supported "age unknown" path); unchanged by design.

## 9. Boundary confirmation (doc 34 §2.1 + §13.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · hospital-scoped (service + DB) · RBAC server-side · **no patient merge**, **no national MPI**, **no real-data migration** · no `01_`/`02_` changes.

## 10. Files changed
- `lib/patient-identity.ts`, `server/services/patient-service.ts`, `server/services/index.ts`, `server/actions/patient-actions.ts`.
- `prisma/migrations/20260630180000_temp_patient_unique/migration.sql`, `scripts/setup-test-db.ts`.
- `server/services/audit-service.ts` (`patient.dob_validation_failed`).
- `tests/unit/patient-identity.test.ts` (+strict-DOB), `tests/integration/phase3f5-identity-hardening.test.ts`.
- `docs/qa-command-output/3F-5/`.
