# HMIS Cameroon — SIGH / DME (prototype)

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

French-first hospital information system prototype for MINSANTE (eight regional
hospitals). This repository is the implementation of the approved planning baseline in
`../Planning/` (ADR-0 stack, Design System v0, Architecture Rules `09`). **Fake data
only — no real patient data, ever.**

The **first walking skeleton is complete** (build sequence Steps 1–13, `09 §14`): the
full golden path works end-to-end — login → select hospital → create patient → open
visit → record consultation → create invoice → record payment → print receipt →
dashboard tile → audit log — French-first, hospital-scoped, with service-layer RBAC and
automatic audit. See [docs/DEMO.md](docs/DEMO.md) for the live script and
[docs/build-log/](docs/build-log/) for per-step notes. Run `npm run smoke` for the
golden-path verification.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui ·
next-intl (French only) · Prisma 7 + PostgreSQL (node-postgres adapter) · zod ·
ESLint + Prettier.

## Prerequisites

- Node.js 20+ (built on 24) and npm
- A local **PostgreSQL** (local install or Docker)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure the database connection
cp .env.example .env        # then edit DATABASE_URL if needed

# 3. Create the database (example for a local install)
createdb hmis_cameroon

# 4. Generate the Prisma client and verify connectivity
npm run db:generate
npm run db:check            # ✓ PostgreSQL OK — server time: …

# 5. Run the app (one command)
npm run dev                 # http://localhost:3000
```

The schema is intentionally empty in this step; domain models arrive at Step 3+.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server (one-command run) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` / `lint:fix` | ESLint (incl. the UI→service import guardrail) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier |
| `npm run db:generate` | `prisma generate` |
| `npm run db:push` | Push schema to the database |
| `npm run db:check` | Verify the live DB connection through the service layer |
| `npm run db:seed` / `db:reset` | Seed / reset the deterministic demo data |
| `npm run smoke:test` | Golden-path smoke test on the **test** DB (reconciliation, numbering, audit, RBAC, scoping) |
| `npm run smoke:dev` | Same, against the **dev** DB — manual/dev-only, fake data only |

## Demo data (Step 3)

`npm run db:seed` loads the deterministic fake base data (07_Demo_Scenario): the active
demo hospital **HRB-DEMO** + 7 inactive regional hospitals, 5 roles, and 5 fictional
users scoped to HRB-DEMO. No patients/visits/invoices are seeded — those are created
live during the demo. `npm run db:reset` returns the data to this known starting state.

Seeded demo users (all share the password **`demo1234`**):

| Nom | Rôle | Identifiant |
|---|---|---|
| Awa NJOYA | Administrateur | awa.njoya@hrb-demo.cm |
| Brigitte MBARGA | Agent d'accueil | brigitte.mbarga@hrb-demo.cm |
| Dr Jean-Paul ETOA | Médecin | jeanpaul.etoa@hrb-demo.cm |
| Solange ABENA | Caissier | solange.abena@hrb-demo.cm |
| Dr Emmanuel TCHOUA | Directeur (lecture seule) | emmanuel.tchoua@hrb-demo.cm |

Log in at `/connexion` with any account above and password `demo1234` (Step 4). _All
data is fake._ RBAC enforcement + the hospital selector arrive at Step 5.

## Structure (09 §2)

```
app/                      Routing & pages (thin; no business logic, no DB)
components/{ui,layout,    Presentational, reusable UI (shadcn-based)
  forms,tables,print}/
features/                 Feature UI per domain (e.g. dashboard)
server/
  actions/                Thin transport boundary (Server Actions; validation)
  authz/                  RBAC / authorization (service-layer)
  services/               Business logic — the only place rules live
  db/                     Hospital-scoped data-access — the only place Prisma runs
lib/{money,dates,         Pure utilities (integer FCFA, FR dates, zod, constants)
  validation,constants}/
prisma/                   Prisma schema (+ migrations/seed later)
messages/fr.json          Single French label glossary (next-intl)
scripts/                  seed / reset / db-check helpers
tests/                    Vitest + Playwright (added later)
docs/                     ADRs and design notes
```

**The one allowed flow (09 §4):** UI → `server/actions` → `server/services` →
hospital-scoped `server/db` → Prisma. The UI never imports Prisma or `server/db`
directly (enforced by ESLint). Money is always integer FCFA, formatted in `lib/money`.

## Conventions

- French-first labels from `messages/fr.json`; English for code/docs.
- The prototype label is visible on every screen (and, later, every printed document).
- Hospital-scoped data access and service-layer authorization from day one.
- Small, atomic commits referencing register IDs (e.g. `D-011`); see `../Planning/08`.

See `docs/adr/` for decisions and `docs/WHERE_I_LEFT_OFF.md` for the current state.
