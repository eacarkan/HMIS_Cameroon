# Phase 5.1 — Stabilisation Report (F-01 + F-02)

**Type:** bounded correctness + security-hardening patch (NOT Phase 6, NOT a new feature phase).
**Baseline:** Phase 5 synthetic RC tip `cee1557` (code) → committed on the review-docs tip `ea7c0a2`.
**Branch:** `feature/phase5-1-stabilisation-f01-f02` · **Final tip:** the Phase 5.1 commit on this branch (hash in the final response / bundle README).
**Scope:** the two High findings from the all-phases expert evaluation — **F-01 payment atomicity** and **F-02 account-lockout enforcement**.

> **Boundaries (unchanged):** synthetic data only · mock/sandbox-first · not Gate 7 · not real-data authorization · not production · not hospital operational use · no live integrations · no contract/admin changes · not merged to `main` · not pushed.

## Dispositions
- **F-01 — RESOLVED by code.** Payment recording is now atomic under a row lock.
- **F-02 — RESOLVED by code.** Failed-login lockout is persisted and enforced in the credentials authorize path.

---

## F-01 — Payment atomicity (RESOLVED)

**Fix.** A new DB-layer `recordPaymentTx` (`server/db/invoices.ts`) runs the whole payment in **one interactive Prisma transaction**:
1. `SELECT "id","totalAmount" FROM "Invoice" WHERE id=… AND hospitalId=… AND deletedAt IS NULL FOR UPDATE` — a narrowly-scoped row lock (the only raw SQL; parameterised).
2. Re-derives the paid-so-far from the **authoritative** recorded payments **inside the lock** (never a stale pre-read).
3. Rejects `amount > remaining` (rolls back).
4. Creates the payment and updates the invoice status (`paid` / `partially_paid`) **together**.

`billing-service.recordPayment` now: keeps a fast, non-authoritative pre-check for a clear UX error, generates the receipt number via the existing atomic sequence, then delegates to `recordPaymentTx`; the audit is written after commit (existing convention). **Preserved:** full + partial payment, `InvoiceItem` snapshot immutability, receipt numbering, `payment.record` audit, cashier/billing golden paths, and **4D external-payment reconciliation** (which calls `recordPayment` → now hardened automatically).

**Transaction strategy.** Interactive `$transaction` + `SELECT … FOR UPDATE` row lock on the invoice; authoritative in-lock re-validation; guarded status update. Concurrent payments serialise on the lock, so a stale pre-read can no longer authorise an over-payment.

**Concurrency test result.** Two concurrent full payments on a 3 000 FCFA invoice → **exactly one succeeds**, the other is rejected under the lock; the invoice **never over-collects** (total = 3 000, status `paid`, one recorded payment). Valid concurrent partials (1 500 + 1 500) both succeed and total exactly. Verified against real PostgreSQL.

---

## F-02 — Account-lockout enforcement (RESOLVED)

**Data model (additive).** Migration `20260701070000_phase5_1_user_lockout` adds to `User`: `failedLoginCount Int @default(0)`, `lastFailedLoginAt DateTime?`, `lockedUntil DateTime?`, `lastSuccessfulLoginAt DateTime?`. No rename, no delete, no id change.

**Policy (pure, `lib/account-security.ts`).** `MAX_FAILED_ATTEMPTS = 5`, `LOCKOUT_DURATION_MINUTES = 15`; `isCurrentlyLocked`, `lockoutUntil`, and `nextFailedLoginState` (increment; an expired lock restarts the counter; the threshold sets a fresh `lockedUntil`).

**Enforcement (`server/services/auth-service.ts`, `authenticateCredentials`).**
1. Unknown **or** disabled account → generic `null`, **no record created** (no user enumeration); a disabled account stays rejected as before.
2. A **currently-locked** account → denied **even with the correct password** (password not checked); the lock-hit is audited (`auth.account_locked`).
3. **Failed** password → persist the incremented counter + `lastFailedLoginAt`; lock at the threshold; audit `auth.login_failed` (and `auth.account_locked` if it just locked); generic `null`.
4. **Successful** password → reset the counter, clear `lockedUntil`, stamp `lastSuccessfulLoginAt`, audit `auth.login`, return the actor.

**Login behaviour summary:** deny-when-locked (even correct password) · generic failure for unknown/locked (no enumeration) · reset on success · disabled unchanged.

**Audit:** `auth.login_failed`, `auth.account_locked` added (known users only — auditing only when the user exists leaks nothing to an attacker). Successful sign-in keeps `auth.login`.

**Test-isolation note:** the seed reseed (`prisma/seed-data.ts`) already restored the demo password + `active` status for isolation; it now **also** clears the lockout fields, so every reseed returns demo accounts to a clean, unlocked baseline (and a fresh demo does likewise).

---

## Schema / migration summary
Additive only: `User` +4 columns (migration `20260701070000_phase5_1_user_lockout`). No destructive/renaming change. `F-01` added **no** schema (behavioural fix). Both dev and test DBs synced (`db push` + `db:test:setup`).

## Tests added (+14)
- **integration** `tests/integration/phase5-1-payment-atomicity.test.ts` (4) — concurrent-overpay prevention, valid concurrent partials, over-amount rejection + status consistency, golden-path full payment + audit.
- **unit** `tests/unit/account-lockout-5-1.test.ts` (5) — increment, threshold-locks, expired-restart, `isCurrentlyLocked`, `lockoutUntil`.
- **integration** `tests/integration/phase5-1-account-lockout.test.ts` (5) — counter increments, threshold locks + correct-password-denied + audited, reset-after-expiry, no user enumeration (unknown creates nothing; locked ≈ unknown), demo users still work + disabled rejected.

## QA commands + final totals (`docs/qa-command-output/phase5-1/FINAL/`)
`typecheck` clean · `lint` **0 errors / 0 warnings** · `test` **424** (unit+component) · `test:integration` **348** · **vitest 772** · `build` green · `smoke` GOLDEN PATH · `check:arch` green · `check:privacy` green · `check:i18n` **22** · `check:release` green · `test:e2e` **65** · **0 MISSING_MESSAGE**. (vitest 758 → **772**: +4 F-01 integration, +5 F-02 integration, +5 F-02 unit; e2e unchanged.)

## Known issues
- The single non-blocking `pg` driver-adapter deprecation warning (F-09) is unchanged — library-level, no application stack frame.
- App-level lockout complements, and does **not** replace, edge rate-limiting (an infrastructure control for production).

## Boundaries
Synthetic data only · not Gate 7 · not real-data authorization · not production · not hospital operational use · no live integrations · no real credentials · no contract/admin changes (`01_/**`, `02_/**` untouched) · not merged to `main` · not pushed.

## RC baseline recommendation
The synthetic RC baseline **should move from `cee1557` to the Phase 5.1 tip** (subject to mentor review): both High findings are now resolved at the software level with green QA, and the Phase 5.1 tip is the more correct RC. Real-data pilot / Gate 7 still require infrastructure, cybersecurity, SOPs, training, signed UAT, and the co-signed MINSANTE decision — unchanged.
