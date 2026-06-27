# Where I left off

**Date:** 2026-06-27
**Last increment:** **Step 4 — auth shell** (login, session, current actor), per
`09 §14` / ADR-0.
**State:** ✅ Done and verified. Login/logout works, `auth.login` is audited,
`next build` + lint + typecheck pass.

---

## What exists now (Steps 1-4)

- **Foundations (1-2):** Next.js App Router shell, French design system, next-intl,
  lib/money, Prisma 7 + local PostgreSQL, UI→service→data-access boundary (ESLint).
- **Fake demo data (3):** schema for the 11-entity skeleton + migration; `lib/numbering`
  (`HRB-DEMO-P-2026-000001`); idempotent seed/reset — 8 hospitals (HRB-DEMO active), 5
  roles, 5 users @ HRB-DEMO, zeroed 2026 sequences. Demo password `demo1234`.
- **Auth shell (4):**
  - Auth.js v5 Credentials provider; bcrypt verification + `auth.login` audit in the
    service layer (`server/auth`, `server/services/auth-service`, `audit-service`;
    data-access `server/db/users`, `server/db/audit`).
  - French login screen at `/connexion` (06 §14) with a demo-accounts hint.
  - Authenticated routes live under `app/(app)/` with a layout guard → `/connexion`
    when unauthenticated. JWT sessions carry the actor's roles + hospital.
  - Top bar shows the real signed-in user + role + hospital, with **Se déconnecter**.

## Verification done

- `GET /` unauthenticated → 307 → `/connexion`.
- Login (Solange ABENA / `demo1234`) → session set; dashboard shows the user/role.
- `auth.login` audit row written (HRB-DEMO, "Connexion de Solange ABENA").
- `npm run build` / `lint` / `typecheck` → ✓. Screenshots `03-connexion`,
  `04-dashboard-connecte`.

## Useful commands

- App: `npm run dev` → http://localhost:3000 (redirects to `/connexion`).
- DB: `npm run db:seed` / `db:reset` / `db:check`. Migration: `npx prisma migrate dev`.
- Start DB if needed: `brew services start postgresql@14`.

## What is intentionally NOT here (deferred)

- **No RBAC enforcement yet** — roles are in the session, but no action checks them.
  Service-layer authorization + the selectable hospital context arrive at Step 5.
- No patient/encounter/consultation/billing/receipt flows. No real data.

## Next step — Step 5 (hospital selector + scoping)

1. A hospital-selection screen/control that sets the active hospital context for users
   with access (here all @ HRB-DEMO); write the `hospital.select` audit entry.
2. Wire `server/db/hospital-context` to the real selected context (replace the
   placeholder), and make data-access functions require it.
3. Begin enforcing in `server/authz`: a refused action fails server-side with a clear
   error and an `authz.denied` audit entry.
4. Then Step 6 (patient search/create + patient banner) starts using the numbering
   service to mint `HRB-DEMO-P-2026-000001`.
