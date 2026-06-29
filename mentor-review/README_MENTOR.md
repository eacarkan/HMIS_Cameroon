# Phase 1A — Mentor Review Bundle (self-contained)

**Project:** MINSANTE SIGH/DME (HMIS/EMR) — French-first pilot-core prototype
**Data:** fake / demo only · **Not** production, **not** real-data authorization (Gate 7), **no** Phase 2 modules.
**Baseline:** Gate 6 (`b48b294`) → Phase 1A → **QA patch `c1b1ace`** on `feature/gate4-ui-workflows`.

> This bundle is **self-contained** — it contains everything needed to review Phase 1A **without access to the Git repository**.

---

## Status — second submission (mentor QA fixes applied)

This bundle includes the **QA patch** for the three required fixes from your first review. Fix-by-fix detail + verification is in **`HMIS_Cameroon/docs/phase1a-implementation-logs/PHASE_1A_QA_PATCH.md`**.

1. **`check:privacy` works without `.git`** — it now falls back to parsing `.gitignore`, so this extracted bundle passes its own privacy check (the issue you flagged). Verified by running it with `.git` absent.
2. **Duplicate-warning override is bound to the exact warned data** — a normalized fingerprint of the identifying fields (name + DOB + phone + sex); editing any of them after a warning re-runs detection and shows a fresh warning instead of silently confirming.
3. **`assignRoleForActor` requires existing hospital membership** — a role can no longer be assigned to a user who does not already belong to the active hospital.

Tests added: **+6 unit** (fingerprint + the edited-after-warning case) and **+1 integration** (cross-hospital role assignment refused).

**Deliberately not changed** (documented as a pre-pilot limitation, per your verdict): the broad `administrateur` RBAC — to be re-partitioned before any pilot / Gate 7, not now. Same for the other "before pilot" items you raised (failed-login lockout counters, EMR amendment version snapshots, a persistent `CashierShift` entity).

---

## What's inside

```
phase1a-mentor-review-complete/
├── README_MENTOR.md            ← you are here
├── HMIS_Cameroon/              ← the full, runnable application (source, tests, config, prisma, docs, screenshots)
│                                 (node_modules / .next / .git / build caches and the secret .env are intentionally excluded)
└── _SPECS_AND_PLANNING/        ← specs that live OUTSIDE the repo (so the mentor can check scope vs. implementation)
    ├── 30_Phase_1A_..._Backlog.md          ← the Phase 1A backlog (canonical scope, §6 = per-batch tasks)
    ├── Phase_1A_Batch_1A..6_*.md           ← the 7 per-batch prompts (acceptance criteria the work was built against)
    ├── 00_README_Prompts_Index.md / 01_MASTER_*.md
    └── PHASE_1A_MENTOR_REVIEW_FILE_LIST.md ← categorized list of the 125 Phase 1A files
```

## Where to start (review by reading)

1. `HMIS_Cameroon/docs/phase1a-implementation-logs/PHASE_1A_QA_PATCH.md` — **start here for the second review**: the three required fixes + their tests and verification.
2. `HMIS_Cameroon/docs/phase1a-implementation-logs/00_PHASE_1A_SUMMARY.md` — one-page overview of all 6 batches + verification results.
3. `HMIS_Cameroon/docs/phase1a-implementation-logs/BATCH_*.md` — per-batch implementation logs (objective, schema decision, files, services, RBAC, audit, tests, screenshots, boundaries).
4. Cross-check each batch against its spec in `_SPECS_AND_PLANNING/Phase_1A_Batch_*.md`.
5. Screenshots (fake data): `HMIS_Cameroon/docs/batch{1a,1b,2,3,4,5,6}-screenshots/`.

**Architecture to keep in mind while reading:** pure libs (`lib/*`, client-safe, unit-tested) → `server/db` (only place Prisma is called) → `server/services` (RBAC + hospital scoping + append-only audit) → `server/actions` → `app/` pages & `components/`. Enforced by ESLint `no-restricted-imports` + `scripts/check-architecture.ts`.

## How to run it (review by executing)

Prerequisites: Node.js 20+, a local PostgreSQL instance.

```bash
cd HMIS_Cameroon
cp .env.example .env          # local/fake values only — set DATABASE_URL + AUTH_SECRET for your machine
npm install
npm run db:test:setup         # provisions the dedicated TEST database (name must contain "test")
npm run test:all              # typecheck → lint → unit + component → integration → build → e2e
npm run smoke:test            # golden-path reconciliation (headless end-to-end)
npm run check:arch            # architecture-layering guardrail
npm run check:privacy         # no secrets, fake accounts only, real-data path disabled
```

Expected (cumulative, after the QA patch): unit + component **110**, integration **86**, e2e **17**, smoke **GOLDEN PATH PASSED**, arch ✅, privacy ✅ (now passes with **or without** `.git`).

## Cross-cutting guarantees

- **No Prisma schema change and no migration in any Phase 1A batch** — `prisma/schema.prisma` and `prisma/migrations/` are untouched. The only `prisma/` change is `seed-data.ts` (Batch 4: restore the demo password on reseed, for test isolation).
- Two schema decisions were flagged and resolved **without** new tables (documented in the batch logs): encounter status-history (Batch 1B — via append-only audit) and lockout counters (Batch 4 — left as a *proposed* additive migration, not built).
- Server-side RBAC, append-only audit, strict hospital scoping on every new path; integer FCFA via `lib/money`; per-hospital `Sequence` numbering.
- French-first UI; the « non destiné à la production » prototype marker remains on every screen and printed document; the real-data path stays disabled and is visibly marked.

## Boundaries respected (whole phase)

Fake/demo data only; no real-data/production authorization (Gate 7 untouched); no Phase 2 operational modules; no Phase 4 integrations (DHIS2 / MPI / offline / insurance / external payments / mobile / BI). The contract package (`01_Administratif_et_Contrat/**`, `02_Package_Contractuel_Final/**`) is **not** included here and was not modified.

## Note on excluded files

- `.env` (real machine secrets) is **deliberately excluded** — copy `.env.example` to `.env` and fill local/fake values.
- `node_modules/`, `.next/`, `.git/`, and build caches are excluded to keep the bundle small; `npm install` rebuilds `node_modules`. `npm run check:privacy` no longer depends on `.git` — it falls back to reading `.gitignore`, so it passes in this extracted bundle (QA fix 1).
