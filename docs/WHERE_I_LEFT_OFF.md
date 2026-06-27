# Where I left off

**Date:** 2026-06-27
**Last increment:** **Step 3 — fake demo data concept** (HRB-DEMO, users, deterministic
IDs), per `09 §14` and `07_Demo_Scenario`.
**State:** ✅ Done and verified. Migration applied, seed/reset work, `next build` +
lint + typecheck pass.

---

## What exists now

**Steps 1-2 (Foundations):** Next.js App Router shell — deep blue-green sidebar (FR
nav), top bar (placeholders), page-header pattern, persistent prototype label, empty
Tableau de bord + "à venir" routes. Design tokens (06), next-intl (French), lib/money
(integer FCFA), Prisma 7 + local PostgreSQL, UI→service→data-access boundary enforced
by ESLint. Pushed to `github.com/eacarkan/HMIS_Cameroon` (branch `main`).

**Step 3 (this increment):**
- **Prisma schema** with the 11-entity skeleton subset + `UserRole` and enums
  (`prisma/schema.prisma`), all hospital-scoped, integer FCFA, soft-delete, neutral
  status codes, per-hospital `Sequence` numbering. Migration
  `…_init_skeleton_models` applied to the local DB.
- **`lib/numbering`** — deterministic number format (`HRB-DEMO-P-2026-000001`).
- **Seed/reset** (`prisma/seed-data.ts`, `scripts/seed.ts`, `scripts/reset.ts`):
  idempotent, fake-only. Known starting state = 8 hospitals (HRB-DEMO active+demo, 7
  inactive), 5 roles, 5 users + role assignments @ HRB-DEMO, zeroed 2026 sequences.
  **No** patient/encounter/invoice (created live during the demo).
- **Demo login password (all users):** `demo1234`.

## Verification done

- `npm run db:seed` → ✓ 8 hospitals / 5 roles / 5 users / 5 userRoles / 4 sequences.
  Re-running is idempotent. `npm run db:reset` → clears operational data + re-seeds.
- DB rows confirmed via psql (users↔roles↔HRB-DEMO; sequences @ 2026 = 0).
- `npm run typecheck`, `npm run lint`, `npm run build` → ✓ all clean.

## Useful commands

- Run app: `npm run dev` · DB connection check: `npm run db:check`
- Seed / reset demo data: `npm run db:seed` / `npm run db:reset`
- New migration: `npx prisma migrate dev --name <name>` · reset+seed: `npx prisma migrate reset`
- Start DB if needed: `brew services start postgresql@14` (db `hmis_cameroon`, role `hmis`).

## What is intentionally NOT here (deferred)

- No auth/RBAC enforcement yet (passwordHash is seeded, but credential verification is
  Step 4). No patient/encounter/consultation/billing/receipt flows. No real data.

## Next step — Step 4 (auth shell)

Implement the Auth.js login + session + current actor (per ADR-0 / 09):
1. Auth.js with a Credentials provider verifying `User.passwordHash` (bcrypt) — the 5
   seeded demo users log in with password `demo1234`.
2. A French login screen (06 §14): centered card, `Identifiant` / `Mot de passe`,
   `Se connecter`, prototype label.
3. Session → current actor available server-side; wire the top-bar user/role slot to
   the real session; write the `auth.login` audit entry from the service layer.
4. Then Step 5 (hospital selector + scoping) wires `server/db/hospital-context` and the
   top-bar hospital slot to real data, and `server/authz` starts enforcing.
