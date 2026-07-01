# SantéGrid — Demo Reset & Backup Runbook

**Phase 6E.** Synthetic demo only. **Manual reset only — no automatic destructive scheduled reset.**

> **Reset policy (Doc 42 §7):** manual reset only · no weekly reset by default · **no automatic destructive scheduled reset** · operator-managed. The operator resets manually if the synthetic demo data becomes messy.

## 1. What "reset" means here
The demo database holds **only synthetic data** (the seeded hospital, the ten `@hrb-demo.cm` accounts, catalogues, and whatever synthetic activity reviewers create). A reset **clears the synthetic operational data and re-seeds the clean demo baseline**. It never touches real data (there is none) and is never run automatically.

## 2. Manual demo reset (operator-run)
Run **only** against the demo database, deliberately, by the operator:

```bash
# Point at the Neon DEMO database (NOT a test/dev DB), then re-seed the clean baseline:
DATABASE_URL="<neon-demo-connection-string>" npm run db:seed
```
- `npm run db:seed` is **idempotent**: it upserts the hospital, roles and the ten demo accounts, and — for test isolation and clean demos — **restores each demo account's password + active status and clears the F-02 lockout fields** (`failedLoginCount`, `lastFailedLoginAt`, `lockedUntil`).
- For a **full** wipe of synthetic operational data before reseeding, use the reset script against the demo DB:
  ```bash
  DATABASE_URL="<neon-demo-connection-string>" npm run db:reset
  ```
  `db:reset` clears operational data and re-seeds the baseline. **Confirm the connection string points at the demo database before running.**

> The repo's `reset`/`db:test:setup` scripts refuse to run against a database whose name does not contain `test`; the **demo** reset is a deliberate operator action against the demo DB and must be run with care.

## 3. Synthetic seed process
- The seed creates: hospital **HRB-DEMO**, the RBAC roles, the **ten synthetic demo users** (all `@hrb-demo.cm`), and the demo catalogues/tariffs.
- The shared **synthetic** demo password is set by the seed / operator setup — **never committed**. Optionally set `NEXT_PUBLIC_DEMO_PASSWORD_HINT` so reviewers can see it on the demo-access page.
- Seeding is deterministic: after a reset the demo baseline is identical each time (numbering restarts at `HRB-DEMO-P/V/F/R-2026-000001`).

## 4. Demo-account verification (after a reset)
1. `GET /api/health` → `{"status":"ok", ...}`.
2. Open `/acces-demo` → the directory lists the ten synthetic accounts.
3. Sign in with a demo account (or one-click, if enabled) → reaches the dashboard.
4. Automated check (against a **test** DB, not the demo DB): `npm run test:integration` includes a **seed-reproducibility** test (`tests/integration/phase6e-seed-reproducibility.test.ts`) that verifies the ten accounts are synthetic, authenticate, and come back to a clean, unlocked baseline after reseed.

## 5. Neon backup / restore
- **Automated backups:** Neon retains automatic backups / history for the project (see the Neon console → Backups / History). Keep the default retention for the demo.
- **Point-in-time restore (rollback):** in the Neon console, restore the branch/database to an earlier point in time if the synthetic data must be rolled back. This is the database counterpart to Vercel's Instant Rollback (app).
- **Manual snapshot (optional):** `pg_dump` the demo DB before a large demo if you want a quick restore point:
  ```bash
  pg_dump "<neon-demo-connection-string>" > santegrid_demo_snapshot.sql   # synthetic data only
  ```
  Store snapshots as **synthetic** artifacts; they contain no real data.

## 6. Optional admin-only reset (documented, NOT automatic)
An in-app, admin-only "reset demo data" action **could** be added later. If it is, it must be **capability-gated (admin only), audited (`demo.reset_performed`), synthetic-only, and never automatic/scheduled**. It is **not** implemented in this phase — the reset stays a manual operator procedure.

## 7. Boundaries
Manual reset only · no automatic destructive scheduled reset · no weekly-by-default reset · operator-managed · synthetic data only · Neon backup/restore documented (not automated by this repo) · not production · not Gate 7.
