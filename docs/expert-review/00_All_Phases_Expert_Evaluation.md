# All-Phases Expert Evaluation — MinSANTE HMIS / SIGH-DME (Phase 1A → Phase 5)

**Reviewer role:** independent senior healthcare-IT architect / public-sector HMIS advisor / security-privacy + clinical-workflow + financial-control reviewer.
**Baseline inspected:** Phase 5 tip `cee1557` (from the Phase 4A–4F accepted tip `2e37994`), branch `feature/phase5h-pilot-readiness`, working tree clean.
**Nature:** internal expert assessment only — **not** a Ministry authorization, **not** Gate 7, **not** an approval for real patient data or production. No application code, tests, or migrations were modified in producing this review.

---

## A. Independent verification (re-run at `cee1557`)

All QA gates were re-run by the reviewer, not taken from the READMEs:

| Gate | Claimed | Verified |
|---|---|---|
| `typecheck` | clean | ✅ clean |
| `lint` | 0 errors / 0 warnings | ✅ 0/0 |
| `test` (unit+component) | 419 | ✅ **419 passed** |
| `test:integration` | 339 | ✅ **339 passed** (55 files) |
| `build` | green | ✅ green |
| `smoke` | GOLDEN PATH | ✅ GOLDEN PATH passed |
| `check:arch` | green | ✅ green |
| `check:privacy` | green (10 fake `@hrb-demo.cm`) | ✅ green |
| `check:i18n` | 22 | ✅ 22 passed |
| `check:release` | green | ✅ green |
| `test:e2e` | 65 · 0 MISSING_MESSAGE | ✅ **65 passed** · **0** MISSING_MESSAGE |
| residual `pg` warning | 1 (documented) | ✅ exactly **1** (library-level; see F-09) |

**The reported evidence is accurate.** vitest 758 (419 + 339) + e2e 65 reproduced exactly; lint is genuinely 0/0; the single documented `pg` deprecation is the only residual warning. This is a materially honest package — the QA claims stand up to independent re-execution.

## B. Cross-checks against code (not just documentation)

| Claim | Cross-check result |
|---|---|
| Server-side RBAC is authoritative | **250** `requireCapability` calls across `server/services/*` — enforcement is broad and lives in the service layer. |
| Central oversight is aggregate-only | `getCentralOversight` reads **only** `listLatestHospitalSnapshots()` — no `patient/encounter/invoice` query in the central read path. |
| 4G never merges/writes patient rows | **No** `prisma.patient.{update,create,delete,upsert}` anywhere in the 4G data/service layer — only a `findMany` read. |
| Mock connectors make no network call | `lib/integration/adapter.ts` + `mpi-adapter.ts` contain **no** `fetch`/HTTP/socket. Network-egress guard tests confirm 0 calls. |
| Additive migrations only | 32 migration folders; **no** `DROP TABLE` / `DROP COLUMN` / `ALTER … DROP` found. |
| Page-level RBAC | **91** page-level `can(actor.roles, …)` union hints vs 10 pages resolving per-hospital roles → see F-03. |
| Payment recording atomicity | `recordPayment` is **not** wrapped in a transaction → see F-01. |
| Account lockout | policy lib exists but **no** persisted counter columns / login enforcement → see F-02. |

---

## C. Scores (1–5; 3 = acceptable for synthetic UAT w/ caveats, 4 = strong for synthetic/pilot-prep, 5 = excellent for non-production scope). Not inflated.

| # | Dimension | Score | One-line justification |
|---|---|:---:|---|
| 1 | Architecture | **4** | Clean UI→actions→services→db→Prisma layering (arch-checked); adapter/mock integration model; config-driven multi-hospital; integer FCFA. Minus: page-level union RBAC hints, no coverage tooling. |
| 2 | Workflow coverage | **4** | ~20 clinical/financial/pharmacy/lab/reporting workflows implemented end-to-end for synthetic UAT; genuinely broad for a prototype. Real-pilot hardening still needed in places (see §D). |
| 3 | RBAC / hospital scoping | **4** | 250 service-layer capability checks; per-hospital resolution; cross-hospital denied; central = aggregate-only. Minus: UI page gating uses the cross-hospital role union (cosmetic; service is authoritative). |
| 4 | Privacy / patient safety | **4** | Aggregate-only central (snapshot-fed), import-staging-before-clinical, validator separation, warning-only matching, no auto-merge, minimal audit payloads, sanitised errors. Minus: `check:privacy` is a lightweight scanner, not a full DLP. |
| 5 | Financial controls | **3** | Strong on cancellation/refund/shift atomicity + immutable invoice snapshots + audit. **But** the core `recordPayment` path is non-transactional with a stale-read balance check (F-01) — the one financial flow that did not get the H2/3F-1 transactional treatment. |
| 6 | Clinical workflow controls | **4** | Consultation + structured diagnosis, enter≠validate, doctor-visibility-only-after-validation, emergency exception. Appropriate for synthetic UAT. |
| 7 | Pharmacy / stock | **4** | Catalogue → batches → FEFO reservation → dispensing (transactional) → dual-validated adjustments → non-negative CHECK constraints → reporting. Strong; SOPs needed for a real pilot. |
| 8 | Lab / radiology | **4** | Manual request/entry/validation with separation of duties; external-result staging never auto-clinical. No live analyzer/PACS (by design). |
| 9 | Integration framework | **4** | Adapter + mock-only + `PRODUCTION_DISABLED` always throws + credential-references-only + flags-off + egress guards. A credible **readiness** layer (not a live integration, by design). |
| 10 | Patient matching / MPI readiness | **4** | Canonical unique pairs, self-pair rejection, warning-only, required reason, **no patient-row modification (proven byte-for-byte)**, mock MPI 0-network, central denied. Conservative exact-match blocking (precision over recall) — appropriate for readiness. |
| 11 | Release-candidate quality | **4** | Synthetic RC marker (surfaced), release docs, `check:release` guard that ties the evidence index to real folders, reproducible `git archive` bundle. |
| 12 | QA evidence | **4** | Large suite incl. negative paths, cross-hospital denial, no-live-call egress guards, concurrency races; per-batch transcripts; independently reproduced. Minus: **no coverage metrics**; e2e count (65) is modest relative to surface area. |
| 13 | Documentation quality | **4** | Thorough per-batch logs + consolidated reviews + corrected QA provenance (5A) + boundary/known-issue statements + traceability from planning docs. Among the strongest parts of the package. |
| 14 | Operational readiness | **2** | Correctly **not** a software deficiency — hardware, LAN/UPS, hosting, backup/restore drills, firewalls, cyber audit, training, SOPs, and Gate 7 authorization are all genuinely pending and outside software. The software's *handling/signalling* of this (readiness panel, `authorized:false`) is strong; actual operational readiness is Not Ready. |
| 15 | Commercial / technical defensibility | **4** | The technical package credibly supports the "full implementation project needing suppliers" narrative and the "software + digital-architecture lead" positioning; synthetic-only boundaries protect against premature production/handover/O&M claims. |
| 16 | **Overall readiness (current non-production scope)** | **4** | Strong, credible **synthetic release-candidate** suitable for controlled demo, DOSTS technical-readiness presentation, and controlled synthetic UAT — provided F-01/F-02 are dispositioned. **Explicitly not** ready for real-data pilot, production, or live integrations. |

**Weighted view:** the programme is a **4/5 synthetic release-candidate**. It is held back from 5 by (a) one real financial-atomicity gap that escaped the otherwise-excellent transactional hardening, (b) absent test-coverage instrumentation, and (c) the cosmetic UI-gating inconsistency — none of which is a synthetic-RC blocker, but F-01/F-02 are must-fix before any real-cash / real-data pilot.

---

## D. Workflow coverage classification

| Area | Class |
|---|---|
| Patient identity + temporary/unknown patient | Strong |
| Outpatient consultation + structured diagnosis | Strong |
| Cashier / billing | Acceptable for synthetic UAT — **needs hardening before real cash (F-01)** |
| Invoice cancellation / refund controls | Strong (atomic, dual-approver) |
| Pharmacy catalogue / batches / FEFO / dispensing | Strong |
| Stock adjustments (dual validation) | Strong |
| Operational reporting + DHIS2 aggregate CSV | Strong (aggregate-only) |
| Queue management | Acceptable for synthetic UAT |
| Hospitalization | Acceptable for synthetic UAT |
| Emergency exception / emergency debt | Strong (atomic accrual, director waiver) |
| Laboratory / radiology (manual) | Strong (separation of duties) |
| External result import | Strong (staging, never auto-clinical) |
| DHIS2 export readiness | Strong (readiness only; no live API) |
| Payment provider abstraction | Acceptable for synthetic UAT (mock only) |
| Insurance / mutuelle | Acceptable for synthetic UAT (manual only) |
| Analytics / reporting | Strong (aggregate-only, no AI) |
| Patient matching / MPI readiness | Strong for readiness (warning-only, no merge) |
| UAT / readiness evidence | Strong |
| Real-time/national interoperability | **Not suitable for real use yet (by design — mock/flag-off)** |

---

## E. What it credibly IS

A **synthetic-data, release-candidate-quality HMIS/EMR prototype** appropriate for: internal technical closure, a controlled synthetic demonstration, a DOSTS technical-readiness presentation, and controlled/extended synthetic UAT preparation. Multi-hospital, French-first (English progressive), hospital-scoped, server-side RBAC, audited, integer-FCFA, mock/sandbox-first with disciplined boundaries and honest QA evidence.

## F. What it is NOT ready for (and why)

- **Real patient data / Gate 7** — administrative + co-signed decision; software `authorized:false` by design; plus F-01/F-02 must be closed first.
- **Production deployment** — no infra/hosting/backup-restore/cyber baseline; account-lockout not enforced (F-02); no load testing (F-06).
- **Hospital operational use** — no SOPs, training, support/incident/fallback procedures.
- **Live DHIS2 / PACS / analyzer / Mobile Money / insurer / MPI** — intentionally mock/flag-off; no production connector exists.
- **Source-code handover** — out of scope; not implied by completion.

---

*See `01_Findings_Register.md`, `02_Readiness_Decision_Matrix.md`, `03_Recommended_Next_Actions.md`. Internal review only — not Gate 7, not a Ministry authorization, does not approve real data or production, does not transfer source code.*
