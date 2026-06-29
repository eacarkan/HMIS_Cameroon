# Phase 1A — Batch 4 Implementation Log — Admin / security hardening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed)
**Branch:** `feature/phase1a-batch-4-admin-security` · **Commit:** `7194a7d` (parent `289106e`)

## 1. Objective
Baseline account-security + admin-traceability: password change/reset, password policy, lockout/session rules, role-assignment safeguards, admin action review, audit event detail, and an **inert** sensitive-read hook.

## 2. Schema / migration decision — **no migration created**
The prompt anticipated additive lockout/reset-token columns, but consistent with this project's careful schema governance I implemented Batch 4 **without a migration**: password change/reset reuse the existing `passwordHash`; lockout is enforced via the existing `User.status` (a disabled account is already rejected at authentication) plus a tested threshold lib; session lifetime via Auth.js config. **Automatic failed-attempt counters** (`failedLoginCount` / `lockedUntil`) are documented as a *proposed additive migration* — deliberately deferred to a reviewed change, not created here. One **seed** change (not schema): `seedBaseData` now restores the demo password + active status on reseed, so password-change tests stay isolated (fake data only; `schema.prisma` and `prisma/migrations` untouched).

## 3. Files changed
- **New:** `lib/password-policy.ts`, `lib/account-security.ts` (lockout + role-assignment rules), `server/actions/account-actions.ts`, `components/account/change-password-form.tsx`, `app/(app)/mon-compte/page.tsx`, `app/(app)/journal-audit/[id]/page.tsx`, tests (`tests/unit/account-security.test.ts`, `tests/component/account-forms.test.tsx`, `tests/integration/account-security.test.ts`, `tests/e2e/security-admin.spec.ts`), `docs/batch4-screenshots/`.
- **Modified:** `server/auth/config.ts` (session maxAge), `server/services/auth-service.ts` (+`changeOwnPassword`), `server/services/user-admin-service.ts` (+`resetUserPassword`, password policy on create, role-assignment guard), `server/services/audit-service.ts` (+`getAuditEntry`, inert `recordSensitiveRead`), `server/db/users.ts` (+`updateUserPassword`), `server/db/audit.ts` (+`findAuditEntryById`), `server/db/index.ts`, `server/services/index.ts`, `app/(app)/administration/utilisateurs/page.tsx` (admin reset), `app/(app)/journal-audit/page.tsx` (detail links), `components/layout/nav.ts` (Mon compte), `lib/constants/index.ts`, `messages/fr.json`, `prisma/seed-data.ts` (test-isolation), `tests/integration/gate5b-reports-users.test.ts` (policy-compliant demo passwords).

## 4. Services changed
`changeOwnPassword` (verify current, enforce policy, audit); `resetUserPassword` (admin, policy, hospital-scoped, audited); `createUserForActor` now enforces the password policy + `canAssignRole`; `assignRoleForActor` rejects unknown role codes; `getAuditEntry` (detail read, audit.read); `recordSensitiveRead` (inert no-op).

## 5. UI changed
`/mon-compte` change-password form (all users); admin password-reset on the user-lifecycle page; audit event **detail** page (`/journal-audit/[id]`) with row links; "Mon compte" nav item.

## 6. RBAC changes
No new capabilities. Change-password = self (any authenticated user); admin reset/role-assign = `user.manage`; audit detail = `audit.read`. Role-assignment safeguard restricts grants to the five coarse roles (least privilege; no unknown/over-privileged codes). Hospital-scoped throughout.

## 7. Audit changes
New actions `auth.password_change`, `auth.password_reset`, `sensitive.read` (French-labelled). `SENSITIVE_READ_AUDIT_ENABLED = false` → the sensitive-read hook is wired but **inert** pending MINSANTE policy.

## 8. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **91** (+8); integration **82** (+5); e2e **15** (+1); smoke GOLDEN PATH PASSED; check:arch ✓; check:privacy ✓ (no secrets). Verified: password change (wrong-current & weak rejected; new works); admin reset (policy + audit + non-admin denied); role-assignment rejects unknown codes; audit detail readable & scoped; **sensitive-read hook writes nothing while disabled**; session maxAge set.

## 9. Screenshots (fake data)
`docs/batch4-screenshots/`: `01-change-password.png`, `02-audit-detail.png`.

## 10. Known issues / notes
Automatic failed-attempt lockout needs persistent counters → flagged as a proposed additive migration, not built (manual lock via account status works today). No reset tokens / email (admin sets a new password). The e2e changes a password and restores it (director account) to keep the shared test DB usable.

## 11. Boundaries respected
Fake data only; no real-data/production authorization; **no SSO/identity-provider integration; no production secrets management; sensitive-read POLICY not activated** (only the inert hook); no schema change / migration; layering + arch/privacy guardrails intact; contract/admin folders untouched.
