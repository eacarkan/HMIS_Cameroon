# Phase 1A — Mentor Review Bundle (self-contained)

**Project:** MINSANTE SIGH/DME (HMIS/EMR) — French-first pilot-core prototype
**Data:** fake / demo only · **Not** production, **not** real-data authorization (Gate 7), **no** Phase 2 modules.
**Baseline:** Gate 6 (`b48b294`) → Phase 1A tip `2ac629f`, merged into `feature/gate4-ui-workflows` (tip `212fd0c`).

> This bundle is **self-contained** — it contains everything needed to review Phase 1A **without access to the Git repository**.

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

1. `HMIS_Cameroon/docs/phase1a-implementation-logs/00_PHASE_1A_SUMMARY.md` — one-page overview of all 6 batches + verification results.
2. `HMIS_Cameroon/docs/phase1a-implementation-logs/BATCH_*.md` — per-batch implementation logs (objective, schema decision, files, services, RBAC, audit, tests, screenshots, boundaries).
3. Cross-check each batch against its spec in `_SPECS_AND_PLANNING/Phase_1A_Batch_*.md`.
4. Screenshots (fake data): `HMIS_Cameroon/docs/batch{1a,1b,2,3,4,5,6}-screenshots/`.

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

Expected (cumulative): unit + component **104**, integration **85**, e2e **17**, smoke **GOLDEN PATH PASSED**, arch ✅, privacy ✅.

## Cross-cutting guarantees

- **No Prisma schema change and no migration in any Phase 1A batch** — `prisma/schema.prisma` and `prisma/migrations/` are untouched. The only `prisma/` change is `seed-data.ts` (Batch 4: restore the demo password on reseed, for test isolation).
- Two schema decisions were flagged and resolved **without** new tables (documented in the batch logs): encounter status-history (Batch 1B — via append-only audit) and lockout counters (Batch 4 — left as a *proposed* additive migration, not built).
- Server-side RBAC, append-only audit, strict hospital scoping on every new path; integer FCFA via `lib/money`; per-hospital `Sequence` numbering.
- French-first UI; the « non destiné à la production » prototype marker remains on every screen and printed document; the real-data path stays disabled and is visibly marked.

## Boundaries respected (whole phase)

Fake/demo data only; no real-data/production authorization (Gate 7 untouched); no Phase 2 operational modules; no Phase 4 integrations (DHIS2 / MPI / offline / insurance / external payments / mobile / BI). The contract package (`01_Administratif_et_Contrat/**`, `02_Package_Contractuel_Final/**`) is **not** included here and was not modified.

## Note on excluded files

- `.env` (real machine secrets) is **deliberately excluded** — copy `.env.example` to `.env` and fill local/fake values.
- `node_modules/`, `.next/`, `.git/`, and build caches are excluded to keep the bundle small; `npm install` rebuilds `node_modules`.
