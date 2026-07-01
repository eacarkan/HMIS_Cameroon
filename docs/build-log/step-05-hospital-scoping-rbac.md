# Step 5 — Hospital selector + scoping + RBAC base

**Date:** 2026-06-27 · **Planning:** 09 §5/§6, 04, 07 §4

## Implemented
- **Active hospital context** via an httpOnly `active_hospital` cookie, resolved per
  request (`server/auth/active-hospital.getActiveHospitalContext`) and validated against
  the actor's accessible hospitals — never trusted from a raw client value (09 §5).
- **Hospital selection screen** `/selection-hopital` (06 §14): accessible hospitals as
  cards; selecting calls `selectHospitalAction` → `hospital-service.selectHospital`
  (access check + `hospital.select` audit) → sets the cookie → dashboard. The `(app)`
  layout guards: no session → login, no active hospital → selector.
- **RBAC matrix** in `lib/rbac` (pure, client-safe): roles → capabilities + `can()`.
  `server/authz` re-exports it + `AuthorizationError`; `authz-service.requireCapability`
  enforces and writes `authz.denied` on refusal (server-side, even if attempted directly).
- **Role-aware sidebar**: nav items declare a required capability and are filtered by
  the actor's roles, so menus visibly differ by role.
- Actor extended with `hospitalIds` (all accessible); top-bar hospital chip is now a
  functional switcher. `HospitalContext` type moved to `lib/` (client-safe) and
  re-exported from `server/db`.

## Verified
Service-level: reception denied cross-hospital access (null); `patient.create` allowed,
`payment.record` denied with `authz.denied` audited; audit chain = auth.login →
hospital.select → authz.denied. Flow: login → 307 `/selection-hopital`. build/lint/
typecheck ✓. Screenshots 05 (selection — only HRB-DEMO shown for reception) and 06
(dashboard — reception sidebar shows only Tableau de bord + Patients).

## Notes
All demo users belong to HRB-DEMO only, so the selector shows one card and the switcher
one entry — the *mechanism* (cookie context + access check + audit) is real and ready
for multi-hospital users.
