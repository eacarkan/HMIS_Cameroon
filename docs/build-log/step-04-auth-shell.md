# Step 4 — Auth shell (login, session, current actor)

**Date:** 2026-06-27 · **ADR:** [ADR-0003](../adr/ADR-0003-auth-shell.md) · **Planning:** ADR-0, 06 §14

## Implemented
- Auth.js v5 Credentials provider; `authorize` delegates to `auth-service` which
  verifies the bcrypt hash and writes the `auth.login` audit (service layer).
- Data-access `server/db/users`, `server/db/audit`; services `auth-service`,
  `audit-service` (action codes).
- French login screen `/connexion` (06 §14) + demo-accounts hint; `LoginForm`
  (`useActionState` → `loginAction`).
- Authenticated routes under `app/(app)/` with a layout guard → `/connexion` when
  unauthenticated. JWT sessions carry roles + hospital. Top bar shows the real user +
  **Se déconnecter**.
- next-auth type augmentation (JWT via `@auth/core/jwt`).

## Verified
Unauthenticated `/` → 307 `/connexion`; login (Solange / `demo1234`) → dashboard shows
user/role; `auth.login` audited. build/lint/typecheck ✓. Screenshots 03–04. 5 commits.
