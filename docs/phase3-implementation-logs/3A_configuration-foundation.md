# Phase 3A — Multi-Hospital Configuration Foundation

**Unit:** 3A · **Branch:** `feature/phase2h-emergency` (single continuous branch carrying all phases) · **Commit message:** `Phase 3A: add multi-hospital configuration foundation (templates, instances, completeness)`

> Run-to-completion mode, full per-unit accountability (doc 34 §3.1.1). Synthetic data only — configuration, never patient data.

## 1. Objective

Build the software foundation to configure **multiple hospitals without code forks**: hospital configuration **templates** (reusable, hospital-agnostic blueprints), a **Bertoua reference** template + an **Ebolowa second-site** instance, and a per-hospital **configuration-completeness dashboard** with a Bertoua/Ebolowa comparison. The proof point: two hospitals built from the *same* template diverge purely by their own data — no code change.

## 2. Commit

- **Message (exact):** `Phase 3A: add multi-hospital configuration foundation (templates, instances, completeness)`
- One focused commit on the single phase branch (no per-unit branch — the operator directed a single branch carrying all phases sequentially; per-unit accountability is preserved through this log + the unit's own commit + its QA evidence folder).

## 3. Test evidence

Raw transcripts: [`docs/qa-command-output/3A/`](../qa-command-output/3A/). All green.

| Command | Result |
|---|---|
| `tsc --noEmit` (typecheck) | exit 0 |
| `eslint` (lint) | exit 0 |
| `scripts/check-architecture.ts` | ✓ UI → actions → services → db → Prisma (no direct DB access) |
| `scripts/check-privacy.ts` | ✓ no secrets; prototype label; 9 fake `@hrb-demo.cm` accounts |
| `npm test` (unit + component) | **315 passed** (61 files) |
| `npm run test:integration` | **242 passed** (35 files) |
| `npm run test:e2e` | **43 passed** (production build) |

> Vitest total **557** (315 + 242). Counts include the post-review regression tests (§9).
| `npm run build` | ✓ (route `/administration/configuration` server-rendered) |
| `npm run smoke` (golden path) | ✓ GOLDEN PATH PASSED |

New tests added for 3A:
- **Unit** — `tests/unit/configuration-template.test.ts` (validation: structure, dedupe, identity-key rejection, department reference; apply-plan create-vs-update counts) and `tests/unit/configuration-completeness.test.ts` (22-category calculator: 100% full / <40% baseline; lab-radiology either-or; comparison divergence). `tests/unit/i18n-parity.test.ts` extended (`configAdmin` now a guarded fully-bilingual namespace).
- **Integration** — `tests/integration/phase3a-configuration.test.ts` (6 tests): Bertoua 100% vs Ebolowa low; **apply raises Ebolowa without a code change** (6/22 → 19/22) and audits `config.template.applied`; **differ-without-code-change** (same structure, distinct identity, separate scoped rows); **cross-hospital isolation** (a Bertoua-only actor cannot resolve an Ebolowa context; comparison spans only the actor's hospitals); RBAC denial + `authz.denied`; `config.completeness.recomputed` + `config.instance.updated`.
- **Component** — `tests/component/configuration-forms-3a.test.tsx` (apply-template picker, recompute, instance-override forms).
- **E2E** — `tests/e2e/multi-hospital-config-3a.spec.ts` (admin configures Ebolowa from the template 6/22 → 19/22; multi-site comparison; non-config role redirected). Screenshots: [`docs/phase3a-screenshots/`](../phase3a-screenshots/).

**Divergence proof (data, not code):** Bertoua `22/22 (100%)`; Ebolowa `6/22 (27%)` at baseline → `19/22 (86%)` after applying `TPL-BERTOUA-REF` (still missing tariffs/medications/stock — configured separately). Ebolowa keeps its own identity (`Hôpital Régional d'Ebolowa`, `HRE-EBO`, region `Sud`) throughout.

## 4. Schema summary (additive only; stop-and-propose outcome)

**Decision:** propose-in-report **and proceed** (doc 34 §2.4 — additive, in-scope, prompt-anticipated). Two new tables, **zero** changes to existing columns; Phase 1A/2 data preserved.

- **`ConfigurationTemplate`** — a shared, hospital-agnostic blueprint: `code` (unique), `name`, `description`, `version`, `sourceHospitalId` (*provenance only*, not a scoping key), `content` (JSONB: departments, services + eligibility flags, settings, document templates), `isActive`. Not hospital-scoped (a template is a shared artifact, never a hard-coded global default). Carries **no** hospital identity and **no** patient/transaction data.
- **`ConfigurationTemplateApplication`** — an audit-grade record of a guarded, hospital-scoped apply: `hospitalId`, `templateId` (+`templateCode`/`templateVersion`), `appliedById`, `createdCount`/`updatedCount`/`skippedCount`, `summary`. Hospital-scoped; FK to `Hospital` + `ConfigurationTemplate`.

Migration: [`prisma/migrations/20260630170000_phase3a_configuration_foundation/migration.sql`](../../prisma/migrations/20260630170000_phase3a_configuration_foundation/migration.sql) (additive `CREATE TABLE` ×2 + indexes + FKs). Mirrored to the test DB via `prisma db push` (no special raw-SQL constraints needed).

## 5. RBAC / audit summary

**Capabilities added** (`lib/rbac/index.ts`, server-enforced via `requireCapability`):
- `config.template.manage` — create/update shared templates (Hospital Admin).
- `config.instance.manage` — apply a template + override this hospital's instance config (Hospital Admin).
- `config.view` — read the completeness dashboard + comparison (Hospital Admin + Director; the prototype maps the doc's "Local IT Lead" onto these roles).

Mapping: `administrateur` → all three; `directeur` → `config.view` (oversight read only). The admin remains **not clinical**. Cross-hospital config is impossible: every service path resolves the active context from the actor's **memberships** (`resolveHospitalContext`), the apply writes only `ctx.hospitalId`'s rows (composite-unique upserts — **no update-by-id-only**), and the comparison only spans the actor's own hospitals.

**Per-hospital capability binding (review hardening — see §9).** `requireCapability` now decides using the roles the actor holds **at the active hospital** (`rolesByHospital[ctx.hospitalId]`), never the cross-hospital role **union** (`actor.roles`). A multi-hospital member therefore cannot borrow a privilege granted at one hospital to act at another. The actor carries both: `roles` (union, for coarse non-authoritative UI/nav hints) and `rolesByHospital` (authoritative, built in `auth-service` from `UserRole` and carried through the JWT/session).

**Audit events added** (`config.*`, append-only, actor + hospital on every event): `config.template.created`, `config.template.updated`, `config.template.applied`, `config.instance.updated`, `config.completeness.recomputed`.

**Hospital scoping at service + DB:** the guarded apply (`applyTemplateToHospital`) runs in one `$transaction`, upserting departments → services (department resolved within the same hospital) → settings → document templates, each keyed by `hospitalId`. The completeness gatherer (`gatherHospitalConfigSummary`) filters every count by `hospitalId`.

## 6. Known issues

- After a template apply, Ebolowa reaches **19/22**; `tariffs`, `medications`, `stock_batches` are intentionally **not** templated (priced/stock master-data is configured per site, separate from the structural foundation) — this is honest rollout state, not a defect.
- The "Local IT Lead" role from doc 32/34 is not a distinct seeded role yet; `config.view` is granted to `administrateur` + `directeur`. A finer role split is a documented future refinement (not required for 3A).
- No central/cross-hospital dashboard (correctly out of scope — that is 3D, gated on 3B). The comparison here is strictly limited to the actor's own memberships.
- The per-hospital capability binding (§9) fixes the **authoritative** layer (`requireCapability`) and the 3A config page's gating. Other pages'/nav's coarse `can(actor.roles, …)` gating still reads the role **union** (a non-authoritative UI hint — the service layer denies regardless). Sweeping page/nav gating to per-hospital across all modules is folded into **3B** (Multi-Hospital Data Separation & RBAC Hardening), which this fix is the foundation for. Today the only seeded multi-hospital member (Awa) is a symmetric admin at both sites, so no page over-renders in the shipped seed.

## 7. Boundary confirmation (doc 34 §2.1 + §4.17)

Synthetic / fake data only · **not Gate 7** · no real patient data · no production deployment · no hospital operational-use authorization · **no direct central patient-level access** · hospital scoping enforced at service **and** DB layer · RBAC enforced server-side · audit on all configuration changes · no infrastructure execution · no Phase 4 integrations · no source-code transfer · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`**.

Unit-specific (§4.17): **no central dashboard**; **no patient-level multi-hospital access**; **no data cloning into patient/transaction tables** (template apply writes only config rows: Department / ServiceUnit / Setting / DocumentTemplate).

## 8. Files changed

**Schema / data**
- `prisma/schema.prisma` — `ConfigurationTemplate`, `ConfigurationTemplateApplication` (+ Hospital back-relation).
- `prisma/migrations/20260630170000_phase3a_configuration_foundation/migration.sql` — additive migration.
- `prisma/seed-data.ts` — Bertoua completeness settings; second-site seed (`seedSecondSiteAndReferenceTemplate`: Ebolowa admin membership + sequences + locale; snapshot Bertoua → `TPL-BERTOUA-REF`); clear template-applications on reset.

**Pure libs**
- `lib/configuration-template.ts` — content type, validation, apply-plan (pure).
- `lib/configuration-completeness.ts` — 22-category readiness model + comparison (pure).

**Data access / services / actions**
- `server/db/configuration-templates.ts` — template CRUD, guarded scoped apply, completeness summary gatherer.
- `server/db/index.ts` — re-exports.
- `server/services/hospital-configuration-service.ts` — RBAC + audit + completeness + manage/apply/override.
- `server/services/index.ts` — re-exports.
- `server/services/audit-service.ts` — 5 `config.*` audit actions.
- `server/actions/configuration-actions.ts` — apply / recompute / override actions.
- `lib/rbac/index.ts` — 3 capabilities + role mapping.

**UI / i18n**
- `app/(app)/administration/configuration/page.tsx` — completeness dashboard + comparison + templates.
- `components/admin/configuration-forms.tsx` — client forms.
- `app/(app)/administration/page.tsx` — hub link (`config.view`).
- `messages/fr.json`, `messages/en.json` — `configAdmin` namespace (fully bilingual) + `admin.manageConfiguration`.

**Auth (review hardening — per-hospital capability binding)**
- `server/services/auth-service.ts` — `AuthenticatedActor.rolesByHospital`; built from `UserRole`.
- `server/services/authz-service.ts` — `requireCapability` decides on `rolesByHospital[ctx.hospitalId]`.
- `server/auth/config.ts`, `server/auth/index.ts`, `types/next-auth.d.ts` — carry `rolesByHospital` through JWT/session.
- `app/(app)/administration/configuration/page.tsx` — page gating uses per-hospital roles.

**Tests / evidence**
- `tests/unit/configuration-template.test.ts`, `tests/unit/configuration-completeness.test.ts`, `tests/unit/i18n-parity.test.ts` (extended).
- `tests/component/configuration-forms-3a.test.tsx`.
- `tests/integration/phase3a-configuration.test.ts` (8 tests, incl. the §9 regression tests).
- `tests/e2e/multi-hospital-config-3a.spec.ts`.
- Review fallout fixes: `tests/integration/phase2-expert-audit.test.ts`, `tests/integration/outpatient-services-2qa.test.ts`, `tests/integration/consultation.test.ts`, `tests/integration/gate5b-reports-users.test.ts`, `tests/component/topbar.test.tsx` (actor literals now set `rolesByHospital`).
- `docs/phase3a-screenshots/`, `docs/qa-command-output/3A/`.

## 9. Adversarial review hardening (pre-commit)

A focused adversarial Workflow (3 skeptical dimensions — cross-hospital leakage, RBAC bypass, schema-additivity/apply — each finding independently verified) ran before commit. It returned **5 findings; 2 refuted** (soft-delete resurrection and skipped-count over-report — both proven not-a-bug), **3 confirmed and all fixed here**:

1. **BLOCKER — cross-hospital privilege escalation (systemic).** `requireCapability` decided on the cross-hospital role **union** (`actor.roles`), so a multi-hospital member who is `administrateur` at hospital A and only `directeur` at hospital B could switch the active hospital to B and apply templates / override config there — a privilege never granted at B. Phase 3A is the first unit to introduce a multi-hospital member, which is why this surfaced now. **Fix:** capability decisions resolve **per-hospital** roles (`rolesByHospital[ctx.hospitalId]`); the union is retained only for non-authoritative UI/nav. Regression test: an asymmetric member (caissier@Bertoua + administrateur@Ebolowa) is **denied** `config.instance.manage` at Bertoua (with `authz.denied` audit) yet **allowed** at Ebolowa. This is the foundation 3B's cross-hospital denial matrix builds on.
2. **MAJOR — hospital-identity leak via document body.** The reference-template snapshot copied Bertoua's receipt **body** ("Hôpital Régional de Bertoua — Démo") into the shared template; applying it to Ebolowa wrote Bertoua's name onto Ebolowa's receipt. **Fix:** the snapshot carries only the generic document structure (type, name, national header) — **never the identity-bearing body**; and `applyTemplateToHospital` never overwrites an existing instance's document body on update. Regression test asserts no Ebolowa document (and the template itself) contains "Bertoua".
3. **nit — doc comment.** The RBAC comment double-attributed "apply" to both config capabilities; corrected so `config.instance.manage` solely owns apply.

The fix to per-hospital RBAC changed behaviour for a few tests that synthesised actors by overriding `.roles` or crafted a non-member context; those were updated to set `rolesByHospital` / assert the stronger (earlier) RBAC denial — no production logic regressed (full suite re-run green).
