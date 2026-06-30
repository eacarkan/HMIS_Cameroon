# Phase 3 — Consolidated Mentor-Review Package

**Project:** HMIS Cameroon (SIGH/DME) prototype · **Phase 3:** multi-hospital rollout readiness · **Branch:** `feature/phase2h-emergency` (single continuous branch carrying Phase 1A → 2 → 3) · **Spec:** `03_Software/Planning/34_Phase_3_Coding_Prompt_Pack_3A_to_3F.md`.

**Data:** synthetic / fake only · **not Gate 7** · no real patient data · no production authorization. All ten units committed; **post-QA-patch** final suite **vitest 632** (unit+component 338 + integration 294), **e2e 50** (production build), `build` / `smoke` (GOLDEN PATH) / `check:arch` / `check:privacy` (10 fake `@hrb-demo.cm` accounts) green. See the **Final QA patch addendum (§6)** for the mentor-follow-up changes that moved integration 287 → 294.

> Implementation order followed doc 34 §3 (not the written prompt order): **3A → 3B → 3F-1 → 3F-2 → 3F-3 → 3F-4 → 3F-5 → 3C → 3D → 3E** ("high-priority 3F not postponed"; 3D only after 3B scoping strongly tested). 3F-1…3F-4 **verified + gap-filled + documented** the Phase 2 hardening (H2/H4/H1/H3) per the operator's direction; 3F-5/3A/3B/3C/3D/3E are new builds.

## 0. Index of Phase 3 files

| Unit | Commit | Implementation log | QA evidence |
|---|---|---|---|
| 3A | `1849380` | [3A_configuration-foundation.md](3A_configuration-foundation.md) | [qa/3A](../qa-command-output/3A/) |
| 3B | `74a700a` | [3B_data-separation-rbac-hardening.md](3B_data-separation-rbac-hardening.md) | [qa/3B](../qa-command-output/3B/) |
| 3F-1 | `bbaaf34` | [3F-1_financial-transaction-hardening.md](3F-1_financial-transaction-hardening.md) | [qa/3F-1](../qa-command-output/3F-1/) |
| 3F-2 | `b3f5f48` | [3F-2_emergency-debt-coupling.md](3F-2_emergency-debt-coupling.md) | [qa/3F-2](../qa-command-output/3F-2/) |
| 3F-3 | `4d66868` | [3F-3_lab-validator-separation.md](3F-3_lab-validator-separation.md) | [qa/3F-3](../qa-command-output/3F-3/) |
| 3F-4 | `d333e7d` | [3F-4_cashier-shift-enforcement.md](3F-4_cashier-shift-enforcement.md) | [qa/3F-4](../qa-command-output/3F-4/) |
| 3F-5 | `5fa6838` | [3F-5_identity-dob-temp-numbering-hardening.md](3F-5_identity-dob-temp-numbering-hardening.md) | [qa/3F-5](../qa-command-output/3F-5/) |
| 3C | `26d2f63` | [3C_site-readiness-checklist.md](3C_site-readiness-checklist.md) | [qa/3C](../qa-command-output/3C/) |
| 3D | `e9a1fbe` | [3D_central-aggregate-oversight.md](3D_central-aggregate-oversight.md) | [qa/3D](../qa-command-output/3D/) |
| 3E | `39b2109` | [3E_uat-gate7-readiness.md](3E_uat-gate7-readiness.md) | [qa/3E](../qa-command-output/3E/) |

Phase 3 commit chain (on `feature/phase2h-emergency`, after the Phase 2 tip `17a9fa1`): `1849380 → 74a700a → bbaaf34 → b3f5f48 → 4d66868 → d333e7d → 5fa6838 → 26d2f63 → e9a1fbe → 39b2109`.

## 1. Per-unit table

| Unit | Commit | Status | Tests added | Schema (additive) | Key RBAC / audit | Known issues |
|---|---|---|---|---|---|---|
| **3A** Config foundation | `1849380` | ✅ | unit (template/completeness), integration (divergence/isolation/RBAC/apply), component, e2e | `ConfigurationTemplate`, `ConfigurationTemplateApplication` | `config.template.manage`/`config.instance.manage`/`config.view`; `config.template.created/updated/applied`, `config.instance.updated`, `config.completeness.recomputed` | tariffs/meds/stock not templated (by design) |
| **3B** Data separation & RBAC | `74a700a` | ✅ | matrix integration (universal gate + 11-table isolation + central role), unit (`canAtHospital`) | none | per-hospital `requireCapability` + `canAtHospital`; `central.aggregate.view` + `superviseur_central`; `central.aggregate.accessed`, `security.cross_hospital_denied` | page-level `can(actor.roles,…)` remain cosmetic hints (service+nav authoritative) |
| **3F-1** Financial atomicity | `bbaaf34` | ✅ (verify H2) | integration (§9.14 ×6) | none | cashier≠approver, requester≠approver; audit on success only | none |
| **3F-2** Emergency debt coupling | `b3f5f48` | ✅ (verify H4) | integration (§10.14 ×6) | none | Director-only waiver (reason); `emergency.debt_*` | placeholder debt for unpriced dispense (by design) |
| **3F-3** Lab validator separation | `4d66868` | ✅ (verify H1) | integration (§11.14 ×4) | none | enter≠validate (service + DB guard) | none |
| **3F-4** Cashier-shift DB enforcement | `d333e7d` | ✅ (verify H3) | integration (§12.14 ×4, incl. concurrency race) | none (uses H3 partial unique index) | one open shift per (cashier,hospital) | cross-hospital independence by index construction |
| **3F-5** Identity / DOB / temp numbering | `5fa6838` | ✅ (new) | unit (strict DOB + max-suffix), integration (concurrency/audit) | partial unique `Patient_temporary_identifier_unique` | `patient.dob_validation_failed` | no patient merge (out of scope) |
| **3C** Site readiness | `26d2f63` | ✅ | unit (READY-gate/rollup), integration, component, e2e | `SiteReadinessStatus`, `SiteReadinessItem` | `readiness.manage`/`readiness.view`; `readiness.status_changed` | central readiness view = 3D |
| **3D** Central aggregate oversight | `e9a1fbe` | ✅ | integration (privacy #1), e2e | `HospitalAggregateSnapshot` | `central.aggregate.view` (global); `central.snapshot.generated` | snapshot generation on demand (no scheduler) |
| **3E** UAT + Gate 7 readiness | `39b2109` | ✅ | unit (signal/disclaimer), integration (§8.14), e2e | `UatStatus`, `UatScenario`, `UatExecution`, `Gate7ReadinessItem` | `uat.manage`/`uat.signoff_placeholder`/`uat.view`; `uat.*`, `gate7.*` | print view = browser print |

All Phase 3 migrations are **additive only** (new tables / enums / a partial unique index); no destructive or renaming change; Phase 1A/2 data preserved.

## 2. Cross-cutting verification

- **Hospital scoping (service + DB) across every module** — a 7-group inventory (3B, adversarially verified) confirmed every high-risk read/write is hospital-scoped at the DB layer (`where { …, hospitalId }`, composite-unique upserts, guarded `updateMany`); `users.findUserBy*WithRoles` are global by design (identity is global; access is contextual via `UserRole`). The 3B matrix test spot-checks 11 representative tables (cross-hospital invisible / own-hospital visible) + the universal membership-resolved context gate (a non-member cannot obtain another hospital's context; the refusal is audited `security.cross_hospital_denied`).
- **Per-hospital RBAC (authoritative)** — `requireCapability` and every inline authoritative check (`audit.read`, operational-report stock snapshot, diagnostic result-visibility, dashboard section visibility) resolve `actor.rolesByHospital[ctx.hospitalId]` — **never** the cross-hospital role union. The only global capability is `central.aggregate.view` (deliberate). This closed a real cross-hospital privilege-escalation BLOCKER found by 3A's review (a member who is admin at A + viewer at B could otherwise act as admin at B).
- **Central oversight — aggregate-only, no patient-level, no direct operational-DB queries** — the central viewer reads **only** `HospitalAggregateSnapshot` (+ hospital identity metadata); snapshots store counts/totals + top-ICD-diagnosis counts with **canonical reference labels** (3D's review fixed a free-text diagnosis-label leak). Privacy integration test proves a planted patient name never reaches a snapshot or the central payload.
- **Lab/radiology validator ≠ entry user** — server guard + DB `NOT enteredById`; doctor cannot see an unvalidated result (3F-3, verifying H1).
- **One open cashier shift per cashier — DB-enforced** — partial unique index; concurrent double-open is race-safe (3F-4, verifying H3).
- **Financial cancellation/refund — atomic & status-guarded** — `$transaction` claims; no double approval/refund; cashier≠approver, requester≠approver; audit on successful transition only (3F-1, verifying H2).
- **Emergency bypass auto-couples `EmergencyDebt`** — pharmacy + lab bypass auto-create/link debt; discharge gate sees it; Director-only waiver with reason (3F-2, verifying H4).
- **Identity / DOB / temporary numbering hardened** — strict `YYYY-MM-DD` (round-trip-checked; future-rejection is calendar-day + 1-day TZ grace), concurrency-safe `MAX(suffix)+1` temp numbering behind a partial unique index, `patient.dob_validation_failed` audit, input preserved on rejection; **no automatic merge** (3F-5).
- **Audit on central access + configuration changes** — `central.aggregate.accessed`, `central.snapshot.generated`, all `config.*`, `readiness.status_changed`, `uat.*`, `gate7.*`, `security.cross_hospital_denied` — append-only, actor + hospital (or null for national reads).
- **Adversarial review caught & fixed real defects before commit** — 3A: cross-hospital privilege-escalation BLOCKER + hospital-identity-in-template MAJOR; 3F-5: future-DOB timezone MINOR + count-vs-max numbering MINOR; 3D: free-text diagnosis-label privacy MAJOR. 3B / 3C / 3E reviews returned no confirmed defects.

## 3. Boundary attestation
Synthetic-data UAT only · **not Gate 7** · no real patient data · no production · **no direct central patient-level access** (central is aggregate-only, snapshot-fed) · hospital scoping at service **and** DB layer · RBAC server-side authoritative (per-hospital) · audit on all central access + config changes · **no infrastructure execution by the software team** · no Phase 4 integrations · no source-code transfer · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`**.

## 4. Gate 7 readiness signal
- **Evidence assembled (software side):** multi-hospital configuration foundation (3A) · proven + hardened data separation and per-hospital RBAC (3B + the 3F block) · site-readiness checklist (3C) · aggregate-only central oversight (3D) · structured UAT + Gate 7 readiness package (3E).
- **Outstanding administrative items — NOT authorized by software:** signed UAT, validated hardware deployment, cybersecurity baseline assessment, backup/restore validation, trained users, support/incident/fallback procedures, and the **co-signed Hospital Director + MINSANTE Gate 7 decision**. 3E tracks these as evidence + sign-off **placeholders**; the readiness report states plainly **"readiness evidence only — not an authorization"** and the readiness signal is hardcoded `authorized: false`.
- **Critical-blocker status (data loss / financial calc error / access-control leak / cross-hospital leakage / missing audit on critical workflows): none expected** — financial flows are atomic + status-guarded; access control is per-hospital server-side; cross-hospital reads are denied (central is aggregate-only); audit is append-only on all critical/central/config workflows; the two privacy defects found in review (template identity, central diagnosis label) were fixed + regression-tested.

## 5. Known issues & recommended next step
- **Known (non-blocking, documented):** page-level `can(actor.roles,…)` UI hints remain union-based (cosmetic; the service layer + nav are authoritative per-hospital); central snapshot generation is on-demand (no scheduler); the readiness/UAT print view uses browser print; tariffs/medications/stock are configured per site (not templated). None are critical blockers.
- **Recommended next step (recommend, do NOT start):** assemble the cleaned Phase 3 mentor bundle for review; on mentor acceptance, run the **administrative** Gate 7 process (signed synthetic UAT, hardware/cyber validation, training) — all outside software authority. **Do not begin Phase 4.**

## 6. Final QA patch addendum (2026-06-30) — mentor follow-up

The mentor **conditionally accepted** Phase 3 for synthetic-data UAT and asked for a focused patch (no new scope) before final acceptance. Delivered as two code commits + this evidence refresh, each with the same per-unit discipline (log + QA evidence + RBAC/audit + boundary). **No application scope change · no schema migration · no production · synthetic data only · per-hospital RBAC and hospital scoping unchanged.**

| Patch unit | Commit | Log | QA evidence |
|---|---|---|---|
| 3P-1 Central oversight snapshot-fed only | `6fc7fcd` | [3P-1_central-oversight-snapshot-fed-only.md](3P-1_central-oversight-snapshot-fed-only.md) | [qa/3P-1](../qa-command-output/3P-1/) |
| 3P-2 Emergency-bypass debt atomic | `c1896a4` | [3P-2_emergency-debt-atomic.md](3P-2_emergency-debt-atomic.md) | [qa/3P-2](../qa-command-output/3P-2/) |
| 3P-3 Refresh QA evidence + reconcile totals | _this commit_ | (this addendum) | [qa/ root](../qa-command-output/) |

**3P-1 — central oversight snapshot-fed only.** Removed the legacy **live** cross-hospital aggregate path (`getCentralAggregates` / `gatherCentralAggregates`, which queried the operational `patient`/`encounter`/`invoice`/`payment` tables directly) from production exports and deleted it — it had **no production caller** (test-only). The **only** central-role-accessible read is now the snapshot-fed `getCentralOversight` (reads `HospitalAggregateSnapshot` + hospital identity only). The `phase3b` central section was rewritten to prove this structurally: with **zero snapshots** `getCentralOversight` returns `[]` (the deleted live path would have enumerated all 8 hospitals), the live exports are asserted gone, and the hospital-role denial is kept.

**3P-2 — emergency-bypass debt atomic with the triggering action.** The emergency `EmergencyDebt` accrual is now folded into the **same `$transaction`** as the pharmacy dispense and the diagnostic start (new `accrueEmergencyDebtWithinTx`), so the service and the debt **commit-or-fail together**; the action **fails (rolls back) if the debt cannot be created**; the **un-flag serialisation** is preserved (encounter row write-lock); the accrual is **idempotent** (in-tx existence check). **No schema change** (idempotency keyed on the deterministic `source` under the row lock — the prompt-allowed existence check, so no stop-and-propose was needed). The manual cashier/Director accrual is unchanged (always creates).

**Adversarial review before commit (3P-2).** A focused Workflow review (atomicity / idempotency / un-flag-serialisation+deadlock / regression) found and this patch **fixed two MAJOR correctness defects — neither broke the atomicity claim**: (1) **stale-read eligibility** — `isPaid` was read before the tx; a payment landing in the window could couple a spurious debt to a now-paid exam/prescription → fixed by **re-deriving `isPaid` inside the tx under the claimed/updated row's lock**; (2) **status-less idempotency dedup** — the existence check matched a settled/waived placeholder, so a later dispense round could deliver goods with no *outstanding* debt → fixed by filtering the dedup on `status: "outstanding"`. Both have dedicated regression tests.

**Refreshed totals (post-patch final tip).** vitest **632** (unit+component **338** + integration **294**), Playwright **e2e 50** (production build), `build` green, golden-path `smoke` pass, `typecheck` clean, `lint` 0 errors (1 pre-existing unused-var warning in a `phase3f1` test, tracked under the optional 3F-1 refund item), `check:arch` + `check:privacy` green. Integration rose 287 → **294**: +6 `phase3p2-emergency-debt-atomic` (4 mentor cases + 2 review regressions) and +1 from the rewritten `phase3b` central section. These are the single source of truth — root `docs/qa-command-output/*` transcripts, `docs/qa-command-output/README.md`, this addendum, and the bundle cover/README all cite the same numbers.

**Optional items (deferred, tracked — not started to avoid scope creep):** 3F-1 refund/cancellation audit transactionality (the mentor marked it *medium / before real cash*; the one remaining lint warning lives in that test file) and page-level UI union→per-hospital role-hint conversion (*medium / cosmetic*; the service layer is authoritative). Both remain tracked for a later pass.

**Boundary (unchanged).** Synthetic-data UAT only · not Gate 7 · no production · additive/refactor only · no schema migration · hospital scoping + per-hospital RBAC unchanged · central oversight aggregate-only + snapshot-fed (no operational-DB query) · audit preserved · no `01_`/`02_` changes · no Phase 4.

— Generated for mentor review. Synthetic data only; not Gate 7.
