# Phase 4G — Patient-Matching / MPI Readiness (Implementation Log)

**Batch:** 4G · **Branch:** `feature/phase4g-patient-matching` (from the Phase 4A–4F accepted tip `2e37994`) · **Commit message:** `Phase 4G: add patient-matching and MPI-readiness foundation`

> **Synthetic data only · NOT Gate 7 · LOCAL + hospital-scoped · WARNING-ONLY · manual review · NO automatic merge · NO live national MPI (mock adapter, no network) · NO cross-hospital patient disclosure · no production claim.** Controlling spec: doc 40 v1.2 §10 (nineteen-section prompt).

## 1. Objective
Add **patient-matching readiness**: local, hospital-scoped, **explainable** duplicate-candidate detection; a **manual review queue** with a **required reason**; and a **mock MPI adapter interface** that makes **no network call**. Nothing merges, blocks, or determines legal identity.

## 2. Schema (additive — §6 model decision, logged)
Migration `20260701060000_phase4g_patient_matching` (additive; no existing-table change):
- **enum `PatientMatchStatus`** — `CANDIDATE / UNDER_REVIEW / MARKED_DUPLICATE / MARKED_NOT_DUPLICATE / NEEDS_MORE_INFORMATION / DISMISSED`.
- **model `PatientMatchCandidate`** — `hospitalId`, `sourcePatientId`, `candidatePatientId` (both FK → Patient, **same hospital**), **`canonicalPairKey`** (deterministically ordered `min::max`), `score` (Int), **`signals`** (Json — explainable fired signals, never nominative), `status`, `reviewedById`/`reviewReason`/`reviewedAt`, timestamps.
- **partial unique index** (raw SQL, both DB paths): `PatientMatchCandidate_active_pair_unique ON (hospitalId, canonicalPairKey) WHERE status IN ('CANDIDATE','UNDER_REVIEW','NEEDS_MORE_INFORMATION')` → **one active candidate per (hospital, canonical pair)**.
- **self-pair CHECK** (raw SQL, both DB paths): `CHECK (sourcePatientId <> candidatePatientId)`.

**§6 model decision (logged).** A **separate additive** `PatientMatchCandidate` was added rather than modifying the existing Phase 1 `PatientDuplicateCandidate` — the latter has a **non-canonical** unique constraint (`[hospitalId, patientId, candidatePatientId]`, so A→B ≠ B→A), a String status, and is used by the registration-time warning path; changing it would risk the Phase 1 golden path and contradicts 4G's canonical-pair rule. The new model is the spec's named model (§6) and carries canonicalization, explainable signals, scoring, and the review state machine. **No `MpiConnectorConfig` table** — the mock MPI adapter is lib-level + a flag (default off), keeping the schema minimal; the config is not a persisted domain object.

## 3. THE SAFETY RULES (all directly tested)
- **Canonical, unique pairs.** `canonicalPairKey(a,b) === canonicalPairKey(b,a)`; the service checks `findActiveCandidateByPair` before creating and catches the partial-unique race; the DB partial-unique index is the backstop → **one active candidate per pair**.
- **Self-pairs rejected.** The generator never pairs a patient with itself (blocking + `isSelfPair`); the DB `CHECK` is the backstop.
- **Local + hospital-scoped; no cross-hospital pairing.** Generation scans only `listPatientsForMatching(ctx.hospitalId)`, so both sides of every pair belong to the same hospital — a matching patient in another hospital is **never** a candidate (tested). Central oversight is unaffected (stays aggregate-only).
- **Warning-only; NO automatic merge; a decision modifies NEITHER patient record.** The only `prisma.patient.*` call in 4G is a `findMany` **read**; every write targets `PatientMatchCandidate`. The integration test records `MARKED_DUPLICATE` and asserts **both patient rows are byte-for-byte unchanged**.
- **Required reason.** Every judgment (mark/needs-info/dismiss) requires a non-empty reason (service + UI `required`); merely starting a review does not.
- **Guarded transitions.** `updateMany({ where: { id, hospitalId, status: from } })` — a concurrent double-decision loses.
- **Mock MPI, no live call.** `resolveMpiAdapter("MOCK")` returns the in-memory `MockMpiConnector` (no network, no national identifier); `PRODUCTION_DISABLED` always throws `MpiLiveDisabledError`; flag `HMIS_MPI_LIVE_ENABLED` default off. A **network-egress guard** test asserts the mock check makes **0 fetch calls**.

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `patient_match.review` + `patient_match.configure` → **administrateur** (the local, non-clinical identity/admin role). **NOT** clinical (medecin); **NOT** the central supervisor (`superviseur_central` cannot see patient-level candidates — tested). Per-hospital; cross-hospital denied.
- **Audit** (minimal payload — IDs + decision/reason, never nominative): `patient_match.candidate_created`, `candidate_updated`, `review_started`, `review_decision_recorded`, `dismissed`, `mock_mpi_checked`.

## 5. Scoring (conservative, explainable)
Weights: `name_exact 45`, `dob_exact 45`, `phone_match 35`, `guardian_phone_match 20`, `sex_match 5`, `estimated_age_range 10`, `temp_identifier_pattern 5`. **Threshold 50** — a single weak-ish signal never surfaces a candidate (phone-only = 35 < 50); the strong pairs are name+DOB (95) or phone+guardian (55). Generation uses **blocking** on the exact-match keys (name / DOB / phone / guardian) — complete for the threshold (no above-threshold pair can miss all four blocks) while avoiding a full O(n²) scan.

## 6. Tests + results (doc 40 §8)
- **unit** `tests/unit/patient-match.test.ts` (5) — canonicalization (A→B ≡ B→A), self-pair reject, explainable/conservative scoring + threshold, the review state machine (must review before deciding; terminals terminal), reason-required.
- **integration** `tests/integration/phase4g-patient-matching.test.ts` (5) — warning-only candidate + **no duplicate active pair on re-run** + audited; **never pairs across hospitals**; **a recorded decision modifies NEITHER patient record** (byte-for-byte); reason-required + **mock-MPI network-egress guard** (0 fetch); RBAC (clinical + central supervisor denied).
- **component** `tests/component/patient-match-4g.test.tsx` (3) — generate form, decision form (required reason + outcomes + no-merge notice), mock-MPI form.
- **e2e** `tests/e2e/integration-match-review-4g.spec.ts` (2) — admin sees the queue + no-merge/mock-MPI notices + runs detection; clinical doctor redirected (RBAC).
- **Suite at this tip:** unit+component **401**, integration **333** (vitest **734**), Playwright **e2e 65** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` **0 errors, 0 warnings** · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase4/4G/`](../qa-command-output/phase4/4G/); screenshot [`docs/phase4g-screenshots/`](../phase4g-screenshots/).

## 7. Known issues
None. (Cross-hospital pairing is prevented structurally by hospital-scoped generation + the service, and tested; a DB-level cross-hospital rejection would need a trigger and is unnecessary given both patient IDs always come from the same hospital scan.)

## 8. Boundary confirmation
Local + hospital-scoped only · warning-only candidates · **canonical unique pairs (A→B ≡ B→A; one active per pair); self-pairs rejected** · manual review only · **a decision records judgment only — no merge/overwrite/correct/modify of either patient record** · **no automatic merge** · **no cross-hospital patient disclosure** · **mock MPI, no live call, no national identifier** · no real credentials · server-side RBAC (per-hospital; central supervisor excluded) · audited (minimal payload) · synthetic · additive schema (§6) · Phase 1A/2/3/4A–4F golden paths preserved · no production claim.

## 9. Files changed
- `prisma/schema.prisma` (+1 enum, +1 model, Patient + Hospital back-relations), `prisma/migrations/20260701060000_phase4g_patient_matching/migration.sql`, `scripts/setup-test-db.ts` (active-pair partial-unique + self-pair CHECK).
- `lib/patient-match.ts`, `lib/integration/mpi-adapter.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+6 actions).
- `server/db/patient-match.ts` + `server/db/index.ts`; `server/services/patient-match-service.ts` + `server/services/index.ts`; `server/actions/patient-match-actions.ts`.
- `app/(app)/patients/match-review/page.tsx`; `components/patients/match-review.tsx`; `components/layout/nav.ts` (+nav item, UserSearch); `messages/fr.json` / `messages/en.json` (`patientMatch` ns + nav); `tests/unit/i18n-parity.test.ts` (+`patientMatch`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4G/`, `docs/phase4g-screenshots/`.
