# Phase 5.1 — Consolidated Mentor-Review Package (Stabilisation: F-01 + F-02)

**Project:** HMIS Cameroon (SIGH/DME) prototype · **Type:** bounded correctness + security-hardening **stabilisation patch** — **NOT Phase 6, NOT a new feature phase** · **Branch:** `feature/phase5-1-stabilisation-f01-f02` (stacked from the Phase 5 synthetic RC tip `cee1557`, via the read-only expert-review docs tip `ea7c0a2`) · **Patch commit:** `f32d0fb`.

**Data:** synthetic / fake only · **not Gate 7 · not real data · not real-data authorization · not production · not hospital operational use · mock/sandbox-first · no live external calls.** Full suite at the Phase 5.1 tip: **vitest 772** (unit+component **424** + integration **348**), Playwright **e2e 65** (production build), `build` / `smoke` (GOLDEN PATH) / `typecheck` / `check:arch` / `check:privacy` / `check:i18n` (22) / `check:release` green; **`lint` 0 errors, 0 warnings**; **0 `MISSING_MESSAGE`**.

> This package fixes **exactly the two High software findings** from the independent all-phases expert evaluation (committed in `ea7c0a2`, under `docs/expert-review/`): **F-01 payment atomicity** and **F-02 account-lockout enforcement**. No new product features; no Phase 6; no live integrations; no real data. All Phase 1A/2/3/4/5 golden paths preserved.

## 0. Index

| Finding | Severity | Disposition | Code | Tests | Evidence |
|---|---|---|---|---|---|
| **F-01** payment atomicity | High | **RESOLVED (code)** | `server/db/invoices.ts` (`recordPaymentTx`), `server/services/billing-service.ts` | [phase5-1-payment-atomicity.test.ts](../../tests/integration/phase5-1-payment-atomicity.test.ts) | [qa/phase5-1/FINAL](../qa-command-output/phase5-1/FINAL/) |
| **F-02** account lockout | High | **RESOLVED (code)** | `lib/account-security.ts`, `server/services/auth-service.ts`, `server/db/users.ts`, `prisma/schema.prisma` (+migration) | [account-lockout-5-1.test.ts](../../tests/unit/account-lockout-5-1.test.ts) · [phase5-1-account-lockout.test.ts](../../tests/integration/phase5-1-account-lockout.test.ts) | [qa/phase5-1/FINAL](../qa-command-output/phase5-1/FINAL/) |

Full technical write-up: [00_Phase_5_1_Stabilisation_Report.md](00_Phase_5_1_Stabilisation_Report.md). Findings-register disposition: [../expert-review/04_Phase_5_1_Findings_Disposition_Addendum.md](../expert-review/04_Phase_5_1_Findings_Disposition_Addendum.md).

## 1. Per-finding table

| Finding | Adds | The guarantee (all tested) |
|---|---|---|
| **F-01** | DB-layer `recordPaymentTx`: one interactive `$transaction` + `SELECT … FOR UPDATE` row lock on the invoice; balance re-derived from the **authoritative** recorded payments **inside the lock**; over-amount rejected; payment-create + status-update committed together. `billing-service.recordPayment` delegates to it (fast UX pre-check preserved; audit after commit). | Two concurrent full payments on a 3 000 FCFA invoice → **exactly one succeeds**; the invoice **never over-collects** (total 3 000, status `paid`, one recorded payment). Valid concurrent partials (1 500 + 1 500) both succeed and total exactly. A stale pre-read can no longer authorise an over-payment. 4D external-payment reconciliation calls `recordPayment` → hardened automatically. |
| **F-02** | Additive `User` columns (`failedLoginCount`, `lastFailedLoginAt`, `lockedUntil`, `lastSuccessfulLoginAt`; migration `20260701070000_phase5_1_user_lockout`); pure policy in `lib/account-security.ts` (5 attempts / 15-min lock); enforcement in `authenticateCredentials`; audit `auth.login_failed` + `auth.account_locked`. | 5 consecutive failures **lock** the account; a locked account is **denied even with the correct password**; success **resets** the counter + stamps last-success; unknown **and** locked accounts return the **same generic `null`** (no user enumeration — an unknown email creates no record); a **disabled** account stays rejected. Seed reseed clears lockout state → test isolation. |

Schema change is **additive only** (F-02: `User` +4 columns). **F-01 added no schema** (behavioural). No destructive/renaming change.

## 2. Cross-cutting verification

- **F-01 correctness under real concurrency.** Proven against real PostgreSQL, not mocks: the row lock serialises concurrent payments and the balance is re-validated **inside** the lock, so the classic read-modify-write over-collection race is closed. Full + partial payment, `InvoiceItem` snapshot immutability, receipt numbering (atomic sequence), and the `payment.record` audit are all preserved.
- **F-02 without user enumeration.** Unknown email → generic `null`, **no row created**; currently-locked known account → generic `null` (indistinguishable from unknown); audit rows (`auth.login_failed`, `auth.account_locked`) are written **only for known users**, so an attacker learns nothing from behaviour or from logs. Disabled accounts remain rejected exactly as before.
- **No behavioural regression.** Every prior golden path is green (`smoke` GOLDEN PATH + the full 772-test regression + e2e 65). The only additive fields are the four `User` lockout columns; every reseed returns demo accounts to a clean, unlocked baseline.
- **Architecture boundaries intact.** `recordPaymentTx` lives in `server/db` (the only Prisma caller); the service layer keeps RBAC (`requireCapability`) and audit; `check:arch` green. The single raw statement is a narrowly-scoped, parameterised `SELECT … FOR UPDATE`.
- **No sensitive data in user errors.** The new payment rejections throw clean French messages that pass through `userFacingMessage` unchanged; `check:privacy` green.

## 3. Boundary attestation
Synthetic-data only · **not Gate 7 · not real data · not real-data authorization · not production · not hospital operational use · mock/sandbox-first — no live external calls** · no live DHIS2 / Mobile Money / insurer / analyzer-PACS / MPI integrations · no real credentials · additive schema only (F-02) · Phase 1A/2/3/4/5 golden paths preserved · **no changes under `01_Administratif_et_Contrat/**` or `02_Package_Contractuel_Final/**`** · not merged to `main` · not pushed.

## 4. Known issues & recommended next step
- **Known:** the single **non-blocking** `pg` driver-adapter deprecation warning (F-09) is unchanged — library-level, no application stack frame. App-level lockout **complements**, and does not replace, edge rate-limiting (an infrastructure control for production).
- **Recommended next step (recommend only):** accept this stabilisation patch and, subject to mentor review, **move the synthetic RC baseline from `cee1557` to the Phase 5.1 tip** — both High findings are now resolved with green QA. The remaining Medium findings (F-03 UI per-hospital gating, F-04 coverage baseline, F-05 load testing) and the external-security item (F-06) are unchanged and still recommended before extended UAT / real pilot. **Any move to live connectors, real data, or production remains an administrative/authorization decision (infrastructure, cybersecurity baseline + pen-test, SOPs, training, signed UAT, MINSANTE Gate 7) outside software scope.** Do not merge to `main` or begin real-data/production work without explicit instruction.

— Generated for mentor review. Synthetic data only; not Gate 7; mock/sandbox-first; a stabilisation patch, not a new feature phase; software-level resolution subject to mentor review, not an authorization.
