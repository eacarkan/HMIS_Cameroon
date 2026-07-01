# ADR-0003 — Auth shell (Step 4)

**Status:** Accepted · **Date:** 2026-06-27 · **Scope:** build sequence Step 4 —
login, session, current actor (`09 §14`, ADR-0 D-005).

Implements authentication with Auth.js while keeping business authorization in the
service layer (09 §3, §6). Records the concrete choices.

---

## Decisions

1. **Auth.js v5 (`next-auth@5` beta) + Credentials provider.** Email + password
   against the seeded users. The provider's `authorize` delegates to the service
   layer (`auth-service.authenticateCredentials`), which verifies the bcrypt hash and
   writes the `auth.login` audit entry — Auth.js answers "who is this?", the service
   owns the rule + the audit (09 §3, §7).
2. **Stateless JWT sessions** (`session.strategy = "jwt"`). The logical model has no
   Session entity; a JWT avoids one. The actor's `roles` + hospital context ride in
   the token and are exposed on `session.user`.
3. **Route protection via a route-group layout guard, not edge middleware.** The
   authenticated app lives under `app/(app)/` whose layout calls `getCurrentActor()`
   and redirects to `/connexion` when there is no session. This runs in the Node
   runtime, so bcrypt + Prisma (in `authorize`) never touch the edge. The login screen
   sits outside the group, so it renders without the sidebar/top bar.
4. **Dependency direction preserved.** `server/auth` (config + actions) → `server/services`
   (auth-service, audit-service) → `server/db` (users, audit data-access) → Prisma. The
   UI imports only the `"use server"` actions (`loginAction`, `signOutAction`), never
   the config or data-access.
5. **JWT type augmentation targets `@auth/core/jwt`.** `next-auth/jwt` only re-exports
   `JWT`, so augmenting it does not merge; the augmentation must name the original
   module (`Session`/`User` augment `next-auth` as normal). See `types/next-auth.d.ts`.
6. **`AUTH_SECRET`** in `.env` (local dev value; `.env.example` has a placeholder).
   `trustHost: true` for local development.

## Not yet (deferred)

- **No RBAC enforcement.** Roles are carried in the session but no action checks them
  yet — service-layer authorization + hospital scoping land at Step 5. The hospital
  shown in the top bar is the actor's assigned hospital, not a *selectable* context.
- The other audit events (patient.create, payment.record, …) are wired as their
  use-cases are built (Steps 6-12).

## Verification

- Unauthenticated `GET /` → 307 → `/connexion`.
- Credential login (Solange ABENA / `HMIS_DEMO_SHARED_PASSWORD`) → 302, session cookie set; authenticated
  `GET /` renders the user + role in the top bar.
- `auth.login` audit row written, scoped to HRB-DEMO, summary "Connexion de …".
- `next build`, lint, typecheck pass. Screenshots `03-connexion`, `04-dashboard-connecte`.
