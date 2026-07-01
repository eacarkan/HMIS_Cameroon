# Phase 3B — Multi-Hospital Data Separation & RBAC Hardening

**Unit:** 3B · **Branch:** `feature/phase2h-emergency` (single continuous branch) · **Commit message:** `Phase 3B: harden multi-hospital data separation and RBAC (cross-hospital denial matrix)`

> This log doubles as the **scoping audit report** required by doc 34 §5.14. Synthetic data only.

## 1. Objective

Prove and harden hospital **data separation** across every Phase 2 module before any central oversight or multi-site UAT expansion: a cross-hospital denial matrix, completion of the per-hospital RBAC enforcement (started in 3A), and an aggregate-only **central oversight** role/capability — with cross-hospital access denied and audited by default.

## 2. Commit

- **Message (exact):** `Phase 3B: harden multi-hospital data separation and RBAC (cross-hospital denial matrix)`
- One focused commit on the single phase branch (per-unit accountability via this log + commit + QA evidence).

## 3. Test evidence

Raw transcripts: [`docs/qa-command-output/3B/`](../qa-command-output/3B/). All green.

| Command | Result |
|---|---|
| `tsc --noEmit` · `eslint` | clean |
| `scripts/check-architecture.ts` | ✓ |
| `scripts/check-privacy.ts` | ✓ 10 fake `@hrb-demo.cm` accounts |
| `npm test` (unit + component) | **318 passed** |
| `npm run test:integration` | **247 passed** |
| `npm run test:e2e` | **43 passed** (production build) |
| `npm run build` · `npm run smoke` | ✓ · GOLDEN PATH ✓ |

> Vitest total **565** (318 + 247).

New tests for 3B:
- **Integration** `tests/integration/phase3b-cross-hospital-denial.test.ts` (5 tests): (a) the **universal context gate** — three single-hospital roles cannot resolve/select another hospital, and the refusal writes a `security.cross_hospital_denied` audit; (b) a **DB-scoping matrix** — a record created in another hospital is invisible under Bertoua's scope across 11 representative high-risk tables (patient/encounter/invoice/payment/department/serviceUnit/medication/stockBatch/setting/documentTemplate/diagnosticCatalogueItem) and visible under its own; (c) the **central supervisor** reads per-hospital aggregates only (structurally asserted — counts + payment total, no nominative field) and the access is audited; (d) a **hospital role (admin) is denied** central aggregates (audited); (e) the **central supervisor has no hospital operational access** (config/patient reads denied at Bertoua).
- **Unit** `tests/unit/rbac.test.ts` (+3): Phase 3A config caps mapping; the central role holds only oversight (no operational caps); `canAtHospital` resolves per-hospital roles, never the union.

## 4. Schema summary

**None.** 3B adds no Prisma model/field and no migration. The central oversight role (`superviseur_central`) + one demo supervisor user are **seed data** only (synthetic). The inventory (below) confirmed no additive field was needed to close any scoping gap.

## 5. RBAC / audit summary

**Per-hospital authorization completed (the 3A foundation, finished here).** Every server-side authorization decision for a **hospital-scoped** capability now resolves the roles held **at the active hospital** (`rolesByHospital[ctx.hospitalId]`), never the cross-hospital union:
- New pure primitive `canAtHospital(rolesByHospital, hospitalId, capability)` in `lib/rbac`.
- Fixed the remaining **inline** authoritative checks that still used the union: `audit-service` (`listAuditEntries`, `getAuditEntry`), `operational-report-service` (pharmacy-snapshot inclusion), `diagnostic-service` (`isDiagnosticStaff` result-visibility gate). `requireCapability` itself was fixed in 3A.
- **Nav** is now filtered by the active hospital's roles (`AppShell` passes `rolesByHospital[active]` to the sidebar), so a multi-hospital member sees only what they may do *here*.

**Central aggregate-only oversight (new).** Capability `central.aggregate.view` — the ONE deliberately **global, cross-hospital, read-only, aggregate-only** capability (checked against `actor.roles`, the documented exception to per-hospital resolution). Role `superviseur_central` holds only `dashboard.read` + `central.aggregate.view` (no hospital operational capability). Service `getCentralAggregates` returns per-hospital **counts + a payment total** (no patient-level field) and audits every access.

**Audit events added:** `central.aggregate.accessed` (every aggregate read; `hospitalId` null — national scope), `security.cross_hospital_denied` (a refused attempt to select a non-member hospital).

**Capabilities/roles:** +1 capability (`central.aggregate.view`), +1 role (`superviseur_central`) + 1 demo user (`direction.regionale@hrb-demo.cm`, synthetic, member at HRB-DEMO for sign-in only).

## 6. Scoping audit report (matrix)

A 7-group **inventory** (multi-agent, adversarially verified) examined every Phase 2 module's `server/db` + `server/services` high-risk reads/writes. **Result: zero confirmed scoping gaps** — every high-risk read/write is already hospital-scoped at the DB layer (creates stamp `hospitalId` from `ctx`; `findById` uses `where { id, hospitalId }`; guarded `updateMany` is status- + hospital-pinned). `users.findUserBy*WithRoles` are global **by design** (identity is global for auth; access is contextual via `UserRole`).

| Module group | High-risk surface | DB-layer scoping | Status |
|---|---|---|---|
| Patients / identity | search/find/update patient, contacts, identifiers, duplicates | `where { …, hospitalId }`; updates re-fetched by id+hospitalId | ✅ |
| Encounters / consultations | open/assign/status, record/finalize/amend | scoped find + create stamps ctx; cross-hospital finalize denied at RBAC (3A) | ✅ |
| Billing / cashier / refunds | invoice/payment, cancellation, refund voucher, shift | scoped finds; atomic status- + hospital-guarded claims (H2/H3) | ✅ |
| Pharmacy / stock / prescriptions | catalogue, stock, reservation, dispense, adjustment, prescription | scoped finds; guarded `$transaction` claims | ✅ |
| Queue / hospitalization / emergency | ticket, admission, daily charge, emergency debt | scoped finds; encounter-row-locked claims | ✅ |
| Diagnostics / reporting / exports | order, catalogue, operational + pharmacy reports, DHIS2 CSV | scoped finds; least-privilege aggregate SELECT (no PII) | ✅ |
| Users / config / documents | user lifecycle, config, templates, document templates | scoped finds; identity reads global by design | ✅ |

**Executable confirmation:** the matrix test spot-checks 11 representative tables (cross-hospital invisible / own-hospital visible) + the universal membership-resolved context gate. The pre-existing `scoping-rbac`, `dashboard` (cross-hospital figures), and each module's own integration test add further per-module coverage.

**Adversarial review (pre-commit).** A focused 2-dimension Workflow (central-aggregate privacy + RBAC-sweep completeness, each verified) returned **0 confirmed findings**. Its one candidate — `getDashboardSummary` passing the role *union* into `visibleDashboardSections` (dashboard section visibility) — was correctly refuted as not-a-bug (cosmetic; data is hospital-scoped; no seeded user is asymmetric). It was nonetheless tightened to per-hospital roles for consistency with the nav, so **no server-side hospital-scoped decision uses the union** — only the intended global `central.aggregate.view` check does.

## 7. Known issues

- **Page-level UI gating** (`can(actor.roles, …)` in page bodies) still reads the cross-hospital **union** as a *non-authoritative* hint. The authoritative layer (every service decision) and the **nav** are per-hospital; a page that over-renders for a hypothetical asymmetric multi-hospital member is denied server-side on any action. A full mechanical sweep of the ~90 page-level hints was intentionally not done (doc 34 §5.11 scopes 3B's UI to "minimal"); it is low-value/cosmetic given the authoritative enforcement. The only seeded multi-hospital member (Awa) is symmetric, so nothing over-renders in the shipped seed.
- **Central oversight UI** is intentionally absent (doc 34 §5.5: "no central dashboard implementation yet" — that is **3D**). 3B delivers the role/capability/service/audit + tests only.
- The central supervisor is seeded with membership at HRB-DEMO purely so the account can sign in (the data model ties every `UserRole` to a hospital); the role grants no operational capability there. A dedicated national node is a 3D/deployment concern.

## 8. Boundary confirmation (doc 34 §2.1 + §5.17)

Synthetic / fake data only · **not Gate 7** · no real patient data · no production · no operational-use authorization · **no direct central patient-level access** (central reads are aggregate-only) · hospital scoping enforced at service **and** DB layer · RBAC server-side authoritative (now per-hospital) · audit on central access + refused cross-hospital attempts · no infrastructure execution · no Phase 4 · no source-code transfer · **no `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**` changes**. Unit-specific: **central aggregate-only**, **no patient-level central role**, **no national MPI / shared patient identity**.

## 9. Files changed

**RBAC core / auth**
- `lib/rbac/index.ts` — `canAtHospital` helper; `central.aggregate.view` capability; `superviseur_central` role.
- `server/authz/index.ts` — re-export `canAtHospital`.
- `server/services/authz-service.ts` — (3A) per-hospital `requireCapability`.
- `server/services/audit-service.ts` — per-hospital `audit.read`; `central.aggregate.accessed` + `security.cross_hospital_denied` actions.
- `server/services/operational-report-service.ts` — per-hospital `stock.read` gate.
- `server/services/diagnostic-service.ts` — per-hospital `isDiagnosticStaff` visibility gate.
- `server/services/dashboard-service.ts` — section visibility uses active-hospital roles.
- `server/services/hospital-service.ts` — audit refused cross-hospital selection.
- `components/layout/app-shell.tsx` — nav filtered by active-hospital roles.

**Central oversight (aggregate-only)**
- `server/db/central-oversight.ts` — `gatherCentralAggregates` (counts + payment total; no patient-level).
- `server/services/central-oversight-service.ts` — `getCentralAggregates` (global cap check + audit).
- `server/db/index.ts`, `server/services/index.ts` — re-exports.

**Seed / counts**
- `prisma/seed-data.ts` — `superviseur_central` role + `Direction Régionale` demo user.
- `tests/integration/auth.test.ts`, `tests/integration/phase1-data-model.test.ts`, `tests/integration/gate3-rbac-audit.test.ts`, `scripts/golden-path.ts` — 9 → 10 users/roles.

**Tests / evidence**
- `tests/integration/phase3b-cross-hospital-denial.test.ts`, `tests/unit/rbac.test.ts` (+3).
- `docs/qa-command-output/3B/`.
