# Phase 5 — Consolidated Mentor-Review Package (incl. Phase 4G)

**Project:** HMIS Cameroon (SIGH/DME) prototype · **Scope:** Phase 4G (patient-matching / MPI readiness) **+** Phase 5 (release-candidate hardening + pilot readiness) · **Branch:** `feature/phase5h-pilot-readiness` (stacked from the Phase 4A–4F accepted tip `2e37994`) · **Specs:** doc 40 v1.2 (4G) + doc 41 v1.2 (Phase 5).

**Data:** synthetic / fake only · **not Gate 7 · not real data · not production · mock/sandbox-first · no live external calls · pilot-readiness evidence is NOT authorization.** Final suite at the Phase 5 tip `193de98`: **vitest 758** (unit+component **419** + integration **339**), Playwright **e2e 65** (production build), `build` / `smoke` (GOLDEN PATH) / `typecheck` / `check:arch` / `check:privacy` / `check:i18n` / `check:release` green; **`lint` 0 errors, 0 warnings**.

> This package covers **both** stages so the mentor can review them together: **Stage 1 — Phase 4G** (the last planned functional foundation), then **Stage 2 — Phase 5** in the mentor order **5A → 5G → 5B → 5C → 5D → 5E → 5F → 5H**. All Phase 1A/2/3/4A–4F golden paths preserved.

## 0. Index

| Unit | Commit | Implementation log | QA evidence |
|---|---|---|---|
| **4G** Patient-matching / MPI readiness | `c6ae960` (tip `6a99c05`) | [4G_Implementation_Log.md](../phase4g-implementation-logs/4G_Implementation_Log.md) · [4G review](../phase4g-implementation-logs/00_Phase_4G_Consolidated_Mentor_Review.md) | [qa/phase4/4G](../qa-command-output/phase4/4G/) |
| **5A** QA hygiene / known-issue burn-down | `1ff43b8` | [5A_qa-hygiene.md](5A_qa-hygiene.md) | [qa/phase5/5A](../qa-command-output/phase5/5A/) |
| **5G** App-level security / access review | `a438a87` | [5G_security-access-review.md](5G_security-access-review.md) | [qa/phase5/5G](../qa-command-output/phase5/5G/) |
| **5B** UX / role-dashboard polish | `cc4c6b3` | [5B_ux-role-dashboards.md](5B_ux-role-dashboards.md) | [qa/phase5/5B](../qa-command-output/phase5/5B/) |
| **5C** UAT scenarios / synthetic data factory | `5c54679` | [5C_uat-data-factory.md](5C_uat-data-factory.md) | [qa/phase5/5C](../qa-command-output/phase5/5C/) |
| **5D** Performance / query hardening | `3e35fc8` | [5D_performance-query-hardening.md](5D_performance-query-hardening.md) | [qa/phase5/5D](../qa-command-output/phase5/5D/) |
| **5E** Validation / error / i18n polish | `80c9320` | [5E_validation-error-i18n.md](5E_validation-error-i18n.md) | [qa/phase5/5E](../qa-command-output/phase5/5E/) |
| **5F** Release-candidate packaging | `7ae008f` | [5F_release-packaging.md](5F_release-packaging.md) | [qa/phase5/5F](../qa-command-output/phase5/5F/) |
| **5H** Pilot readiness / demo rehearsal | `193de98` | [5H_pilot-readiness.md](5H_pilot-readiness.md) | [qa/phase5/5H](../qa-command-output/phase5/5H/) |

Chain from the Phase 4A–4F accepted tip `2e37994`: `c6ae960 → 6a99c05` (4G) → `1ff43b8` (5A) → `a438a87` (5G) → `cc4c6b3` (5B) → `5c54679` (5C) → `3e35fc8` (5D) → `80c9320` (5E) → `7ae008f` (5F) → `193de98` (5H).

## 1. Per-unit table

| Unit | Commit | Adds | The guarantee |
|---|---|---|---|
| **4G** | `c6ae960` | `PatientMatchCandidate` (canonical pair key, explainable signals, review state machine) + partial-unique active-pair index + self-pair CHECK; mock MPI adapter (lib-only, no network) | local + hospital-scoped, **warning-only**; canonical unique pairs (A→B ≡ B→A); self-pairs rejected; **no auto-merge — a decision modifies neither patient record** (proven byte-for-byte); mock MPI 0 fetch; `patient_match.review` admin-only (clinical + central denied) |
| **5A** | `1ff43b8` | `check:i18n` script; per-phase QA index; non-stale READMEs | lint 0/0; 0 `MISSING_MESSAGE`; no behaviour/schema change |
| **5G** | `a438a87` | generated capability↔role matrix; access-review invariants + unauthorized-access sweep | `central.aggregate.view` is the sole cross-hospital cap (superviseur_central only); no clinical over-grant; live flags fail closed |
| **5B** | `cc4c6b3` | nav grouped into ordered sections | reduces clutter **without hiding any control/status indicator**; role-nav tests prove grouping hides nothing; RBAC unchanged |
| **5C** | `5c54679` | synthetic-data factory + demo profiles | deterministic after reset; 100% synthetic (`DEMO_*`); edge cases (emergency debt, insurance claim, matching, billing) |
| **5D** | `3e35fc8` | serialised in-tx reads; no-`unstable_cache` guard | removed the actionable `pg` deprecation cause; dashboard parallel aggregate stays hospital-scoped; residual warning is library-level (documented) |
| **5E** | `80c9320` | `userFacingMessage` sanitiser across all 31 actions | no technical/Prisma/SQL/secret leak in user errors; clean validation messages preserved; no rule change |
| **5F** | `7ae008f` | RC version marker + release docs + `check:release` | synthetic RC (no production/Gate-7 claim); evidence index verified against reality |
| **5H** | `193de98` | readiness/DEMO markers + pilot docs | **readiness evidence only — NOT an authorization** (`authorized: false` even with complete evidence) |

All 4G/Phase-5 schema is **additive** (only 4G added tables/enum + a partial-unique index + a CHECK; Phase 5 added none); no destructive/renaming change.

## 2. Cross-cutting verification

- **Mock/sandbox-first · no live external calls · no real credentials.** Every external touch-point is adapter-mediated (integration, DHIS2, payment, external result, **MPI**); mock connectors make **0** network calls (egress-guard tests across 4A/4B/4D/4G); live flags (`HMIS_INTEGRATION_LIVE_ENABLED`, `HMIS_MPI_LIVE_ENABLED`) fail closed (5G unit assertions); credential references only. No production connector ships.
- **Hospital scoping + per-hospital server-side RBAC.** Every read/write is hospital-scoped at the DB layer; `requireCapability` resolves `rolesByHospital[ctx.hospitalId]`; the 5G access-review sweep proves clinical roles cannot reach admin/finance/integration/analytics/patient-match surfaces and the admin has no cross-hospital reach.
- **Central aggregate-only.** `central.aggregate.view` is the sole cross-hospital capability (superviseur_central only); the central supervisor is denied patient-level (4G) and finance (4E) surfaces (5G integration test). No patient-level central disclosure.
- **Patient matching is safe (4G).** Canonical unique pairs; self-pairs rejected; **no automatic merge** — a recorded decision writes only match records and modifies neither patient row (byte-for-byte proven); mock MPI, no network, no national identifier.
- **Control visibility preserved (5B).** Nav decluttering groups items; it hides no financial/clinical/emergency/stock/validation/authorization/mock-sandbox control or status indicator (role-nav tests assert grouped set == filtered set).
- **No sensitive data in user errors (5E).** All 31 server actions sanitise unexpected errors to a safe French message; clean validation messages pass through.
- **Reproducible release (5F) + i18n parity.** `check:release` verifies a synthetic RC marker + that the evidence index matches real folders; `check:i18n` guards bilingual parity (22 namespaces; 0 `MISSING_MESSAGE`).
- **All golden paths green.** `smoke` (GOLDEN PATH) + the full regression pass at the Phase 5 tip.

## 3. Boundary attestation
Synthetic-data only · **not Gate 7 · not real data · not production · mock/sandbox-first — no live external calls by default** (egress-guarded; flags off) · credential references only · **patient matching warning-only, no auto-merge, mock MPI (no network)** · central aggregate-only (no patient-level disclosure) · hospital scoping (service + DB) + per-hospital server-side RBAC · **UX polish hides no control/status indicator** · no sensitive data in user-facing errors · reproducible RC packaging · **pilot-readiness evidence is NOT an authorization** (`authorized: false`) · additive schema only (4G) · Phase 1A/2/3/4A–4F golden paths preserved · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`** · not merged to `main`.

## 4. Known issues & recommended next step
- **Known:** one **non-blocking** `pg` driver-adapter deprecation warning (no application stack frame; the app-level cause was fixed in 5D). External integrations are mock-only and scheduled runs are placeholders — both by design. No critical blocker.
- **Recommended next step (recommend only):** review this consolidated 4G + Phase 5 package (`phase5-mentor-review.zip`). Any move to live connectors, a live/national MPI, real credentials, real data, or production is an **administrative/authorization** decision outside software scope. Do not merge to `main` or begin real-data/production work without explicit instruction.

— Generated for mentor review. Synthetic data only; not Gate 7; mock/sandbox-first; readiness evidence, not authorization.
