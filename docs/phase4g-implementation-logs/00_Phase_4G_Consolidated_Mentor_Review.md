# Phase 4G — Consolidated Mentor-Review Package

**Project:** HMIS Cameroon (SIGH/DME) prototype · **Phase 4G:** patient-matching / national-MPI **readiness** (local, warning-only) · **Branch:** `feature/phase4g-patient-matching` (from the Phase 4A–4F accepted tip `2e37994`) · **Spec:** `03_Software/Planning/40_Phase_4G_Patient_Matching_MPI_Readiness_Planning_and_Coding_Prompt.md` (v1.2).

**Data:** synthetic / fake only · **not Gate 7 · not real data · not production · local + hospital-scoped · warning-only · manual review · NO automatic merge · NO live national MPI (mock, no network) · NO cross-hospital patient disclosure.** Final suite at this tip: **vitest 734** (unit+component **401** + integration **333**), Playwright **e2e 65** (production build), `build` / `smoke` (GOLDEN PATH) / `typecheck` / `check:arch` / `check:privacy` (10 fake `@hrb-demo.cm` accounts) green; **`lint` 0 errors, 0 warnings**. Evidence [`docs/qa-command-output/phase4/4G/`](../qa-command-output/phase4/4G/).

## 0. Index

| Unit | Commit | Implementation log | QA evidence | Screenshots |
|---|---|---|---|---|
| 4G Patient-matching / MPI readiness | `c6ae960` | [4G_Implementation_Log.md](4G_Implementation_Log.md) | [qa/phase4/4G](../qa-command-output/phase4/4G/) | [phase4g-screenshots](../phase4g-screenshots/) |

Built on the Phase 4A–4F accepted tip `2e37994` (mentor-accepted); all Phase 1A/2/3/4A–4F golden paths preserved.

## 1. What 4G is (and is not)

4G adds **patient-matching readiness**: LOCAL, hospital-scoped, explainable **duplicate-candidate** detection + a **manual review** queue + a **mock MPI adapter** (no network). It is **not** identity determination and **not** record merging:

- **Warning-only.** Candidates are assistive warnings; a human reviews them. Nothing is automatic.
- **No automatic merge.** A recorded decision captures the reviewer's **judgment only** — it modifies **neither** patient record (proven byte-for-byte in the integration test; the only `prisma.patient.*` call in 4G is a read).
- **Local + hospital-scoped.** Both patients in a pair belong to the **same** hospital; a matching patient in another hospital is never a candidate.
- **No live national MPI.** The MPI adapter is a mock that makes **no network call** and returns **no national identifier**; live mode is flag-off and `PRODUCTION_DISABLED` always throws.
- **Central stays aggregate-only.** The central supervisor **cannot** see patient-level candidates.

## 2. Per-unit table

| Unit | Commit | Tests added | Schema (additive) | Key RBAC / audit | The guarantee |
|---|---|---|---|---|---|
| **4G** | `c6ae960` | unit 5, integration 5, component 3, e2e 2 | `PatientMatchCandidate` (`canonicalPairKey`, explainable `signals` Json, score, review state machine) + `PatientMatchStatus` enum + **partial-unique active-pair index** + **self-pair CHECK** | `patient_match.review` / `patient_match.configure` → **administrateur** (NOT clinical, NOT central); `patient_match.candidate_created/updated`, `review_started`, `review_decision_recorded`, `dismissed`, `mock_mpi_checked` (minimal payload) | local, hospital-scoped, warning-only; **canonical unique pairs (A→B ≡ B→A; one active per pair); self-pairs rejected**; **a decision modifies neither patient record**; **no auto-merge**; **mock MPI, no live call**; central excluded |

The 4G migration is **additive only** (new enum + table + a partial-unique index + a CHECK); no destructive/renaming change; the Phase 1 `PatientDuplicateCandidate` is left untouched.

## 3. Cross-cutting verification

- **Canonical, unique pairs.** `canonicalPairKey(a,b) === canonicalPairKey(b,a)` (unit); the service dedupes against the active pair and the DB **partial-unique index** (`WHERE status IN active`) is the backstop; a second generation run creates **0** duplicates (integration).
- **Self-pairs rejected.** The generator never forms a self-pair (blocking + `isSelfPair`); the DB `CHECK (source <> candidate)` is the backstop.
- **No cross-hospital pairing.** Generation scans only the active hospital's patients, so both sides of every pair are same-hospital; a planted matching patient in another hospital appears in **no** candidate (integration). Central oversight is unaffected (aggregate-only, snapshot-fed — unchanged from 3D).
- **No automatic merge; judgment-only.** 4G writes only `PatientMatchCandidate` rows (create + guarded `updateMany`); the sole `prisma.patient.*` is a `findMany` read. Recording `MARKED_DUPLICATE` leaves **both** patient rows byte-for-byte unchanged (integration).
- **Required reason + guarded transitions.** Every judgment needs a non-empty reason; transitions are guarded `updateMany({ status: from })` so a concurrent double-decision loses.
- **Mock MPI, no network.** The mock adapter makes **0 fetch calls** (network-egress guard); returns no national identifier; live mode is flag-off and `PRODUCTION_DISABLED` always throws.
- **RBAC — per-hospital, central excluded.** `patient_match.review` is held by the local `administrateur` only; a clinical doctor and the `superviseur_central` are both **denied** patient-level review (integration); cross-hospital acts are denied by the per-hospital capability check.
- **Privacy.** Audit payloads carry IDs + decision/reason only — never patient names/phones; explainable `signals` store signal **types**, not nominative detail.

## 4. Boundary attestation
Synthetic-data only · **not Gate 7 · not real data · not production** · local + hospital-scoped · warning-only candidates · **canonical unique pairs; self-pairs rejected** · manual review only · **a decision records judgment only — no merge/overwrite/correct/modify of either patient record** · **no automatic merge** · **no cross-hospital patient disclosure** · **mock MPI, no live call, no national identifier** · no real credentials · server-side RBAC (per-hospital; central supervisor excluded) · audited (minimal payload) · additive schema (§6) · Phase 1A/2/3/4A–4F golden paths preserved · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`** · not merged to `main`.

## 5. Known issues & recommended next step
- **Known:** none. Cross-hospital pairing is prevented structurally (hospital-scoped generation) and tested; a DB trigger for it is unnecessary.
- **Recommended next step (recommend only):** review this 4G package. Any move to a live MPI, a national identifier, automatic merge, or production is an **administrative/authorization** decision outside software scope and is deliberately excluded here.

— Generated for mentor review. Synthetic data only; not Gate 7; local, warning-only, no auto-merge, mock MPI.
