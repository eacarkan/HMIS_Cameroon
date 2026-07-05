# Phase 6.6 — Finance / Bank Reconciliation — Mentor Review Package

**Branch:** `feature/phase6-6-unit1-finance-schema-seed` (all Phase 6.6 work), from `deploy/santegrid-webdemo` = `0caf1dcc`.
**Scope delivered:** Units 1–7 (schema/seed, Mobile Money, receivables aging, deposit/bank reconciliation,
numbered monthly revenue statement, finance workspace + demo guide + continuity note).
**Not merged, not pushed. Neon untouched.** 52 files changed (excl. screenshots), +4647/−33.

## 1. Final commit list (13, chronological — `git log --oneline --reverse 0caf1dcc..HEAD`)
```
800bc9c8  Phase 6.6 Unit 1: add finance reconciliation schema and synthetic seed support
3659e19a  Phase 6.6 Unit 2: Mobile Money operator/reference + per-operator report
80849f5d  Phase 6.6 Unit 3: receivables aging (read-only, reconciling)
d4be9416  Phase 6.6 Unit 4: deposit / bank reconciliation
c7265dca  Phase 6.6: eslint — ignore _-prefixed intentionally-unused args
8167e3d1  Phase 6.6 Unit 5: numbered monthly revenue statement
1acd9919  Phase 6.6 Unit 6+7: finance workspace, demo-guide path, continuity note
fb82c64e  Phase 6.6: finance e2e (workspace, reconciliation, revenue statement, RBAC)
4f3a5f59  Phase 6.6: finance workspace screenshots (evidence)
553e07b5  Phase 6.6: atomic bank-line matching (close over-match race)   ← over-match concurrency fix
6a324de5  Phase 6.6: mentor review package
389a1db5  Phase 6.6: statement completeness + aging/unlink test hardening
(HEAD)    Phase 6.6: review-package consistency (this commit — final HEAD in the returned status)
```
The over-match concurrency fix (`553e07b5`) IS in this list. The final HEAD hash is confirmed in the
returned status after the package-consistency commit lands.

## 2. Schema / migration summary
The **single additive migration** ships in Unit 1 — [migration.sql](../../prisma/migrations/20260705120000_phase6_6_finance_reconciliation/migration.sql)
(175 lines, fully additive). Enums `DepositSlipStatus` + `BankLineMatchStatus`; `SequenceType` += `deposit_slip`,`revenue_statement`;
`Payment` += nullable `mobileMoneyOperator`/`mobileMoneyReference`; 4 tables `DepositSlip` / `DepositSlipPayment` /
`BankStatementLine` / `BankReconciliationMatch` + indexes + FKs + positive-amount CHECKs. No existing column renamed/
dropped/retyped. Applied to **local + test only** (via `psql`, autocommit — not `db push`, not reset). Full Unit-1
detail: [PHASE_6_6_UNIT1_SCHEMA_SEED.md](PHASE_6_6_UNIT1_SCHEMA_SEED.md).

## 3. Files changed (highlights of 51)
- **Rules (pure):** `lib/finance/index.ts` (transitions, over-match, reconcile gate, cross-hospital, aging buckets); `lib/dates` (month helpers); `lib/numbering` (BV/ETAT).
- **Data-access:** `server/db/finance.ts` (finance reads + reconciliation overlay CRUD, all hospital-scoped); `server/db/invoices.ts` (recordPaymentTx MoMo threading).
- **Services:** `momo-report-service`, `receivables-service`, `reconciliation-service`, `revenue-statement-service`, `billing-service` (MoMo capture).
- **Actions:** `billing-actions` (MoMo), `reconciliation-actions`, `revenue-statement-actions`.
- **Pages:** `/facturation` (finance workspace), `/facturation/{mobile-money,creances,rapprochement,rapprochement/[id],etat-recettes}`; `/recus/[id]` + `receipt-document` (MoMo display); `/demo-guide` (finance step).
- **Components:** `finance/reconciliation-forms`, `finance/revenue-statement-{document,view}`, `billing/payment-form` (MoMo fields).
- **RBAC:** `lib/rbac` (reconciliation.view|manage, receivables.view, revenue_statement.read, momo.report.read on caissier/administrateur/directeur). **Audit:** 7 new action codes (bilingual labels).
- **i18n:** `messages/fr.json` (French-only `finance` namespace + billing/receipt MoMo keys), `messages/{fr,en}.json` (bilingual `nav` + `demoGuide.steps.finance`).
- **Seed:** `scripts/seed-demo-finance.ts` + `seed-demo.ts` (arrears + finance overlay).

## 4. Screenshots (authenticated cashier, synthetic data)
Under [docs/qa-command-output/web-deployment/6_6-finance/](../qa-command-output/web-deployment/6_6-finance/):
`01-finance-workspace`, `02-momo-report`, `03-receivables-aging`, `04-reconciliation` (+ `04b-slip-detail`),
`05-revenue-statement`, `06-momo-receipt` (shows "Opérateur: MTN · Réf. MM-MTN-000017"), `07-finance-demo-guide`.

## 5. Seed impact
`db:seed:demo` (HRB-DEMO, synthetic): 4 deposit slips (one per lifecycle state, +1000 variance on the disputed one),
20 slip↔payment links, 17 MoMo payments tagged (MTN/ORANGE), 4 synthetic bank lines (1 matched, 3 gaps), 6 arrears
across all aging buckets. Zero invoice/payment money mutated.

## 6. QA results
- `prisma generate` ✓ · typecheck ✓ · lint ✓ (0/0) · build ✓ (all finance routes emitted)
- `check:arch` ✓ · `check:privacy` ✓ · `check:release` ✓ · `check:i18n` ✓ (34)
- **unit + component: 507/507** ✓ · **integration: 385/385** ✓ (Phase 6.6 adds 23 integration + finance unit/component)
- **finance e2e: 4/4** ✓ (workspace, deposit-slip creation, numbered statement, RBAC redirect)

### 6a. Monthly revenue statement — contents confirmed (item 6)
The statement (`getRevenueStatement` + `RevenueStatementDocument`) reports: **total invoiced** (gross billed,
excl. draft + cancelled), **collected by method** (`byMethod`, sums to total collected), **refunds/reversals**
(Σ executed `RefundVoucher`, `status=paid`), **net collected** (collected − refunds), **arrears movement**
(invoiced − collected), a **numbered reference** (`HRB-DEMO-ETAT-YYYY-NNNNNN`), **audit-trace wording** ("chaque
montant est traçable dans le journal d'audit"), and the **synthetic marker** (PROTOTYPE_LABEL + "données
synthétiques"). It contains **no** certificate/certified/attestation/official-accounting language (asserted by
a test that greps `finance.statement` i18n for `/certif|attestation/i`). Tests:
`tests/integration/phase6-6-revenue-statement.test.ts` (figures + refunds + wording, 7 cases).

### 6b. Receivables aging — exclusions + reconciliation confirmed (item 7)
`listOpenInvoicesWithPayments` filters `status ∈ {issued, partially_paid}` → **excludes draft, paid, cancelled**;
`listOutstandingEmergencyDebts` filters `status = outstanding` → **excludes settled, waived**; the service loop
skips `outstanding ≤ 0`; and `reconciles` asserts **Σ bucket totals == Σ invoice outstanding + Σ emergency
outstanding** (exact). New test `phase6-6-receivables.test.ts` asserts a cancelled invoice + a settled + a waived
emergency debt are all excluded (aging total 0, reconciles true).

## 7. Money-path guardrails (proven)
- Payment creation stays **only** through `recordPayment → recordPaymentTx` (F-01 atomic). The MoMo snapshot is
  persisted atomically inside that tx; nulled for non-mobile_money.
- Reconciliation is **metadata-only**: integration test snapshots full Invoice+Payment money state before/after a
  complete deposit→import→match→clear flow and asserts unchanged. Deposit/aging/statement never `UPDATE` a money field.
- **Rejected:** cross-hospital match/link (hospital-scoped lookups + `assertSameHospital`); over-matching a bank line
  (`sumMatchedForBankLine` + `assertBankLineMatch`); a payment on two active slips (DB `@@unique` + service guard);
  invalid status transitions incl. clear-without-reconcile. Every financial action audited (7 new codes).

## 8. Adversarial review results (4 independent reviewers)
Money-path, RBAC/scoping, and public-safety-wording came back **confirmed_ok**. Validation-rules raised one
**MAJOR**, now **fixed**:
- **[MAJOR — fixed] Over-match race.** `matchBankLineToSlip` was a check-then-insert with no row lock, so two
  concurrent matches on one bank line could each pass the `Σ + new ≤ amount` check and both insert → over-match.
  **Fix:** `matchBankLineTx` (server/db/finance.ts) now locks the bank-line row (`SELECT … FOR UPDATE`),
  re-derives Σ matched **inside** the lock, rejects over-match, and writes the match + derived status
  atomically — the same F-01 discipline as `recordPaymentTx`. New integration test fires two concurrent 7000
  matches on a 10000 line and asserts exactly one succeeds and Σ ≤ 10000.
- **[nit — documented]** a 0-declared slip can reach `cleared` with no bank matches (`depositSlipReconciles(0,0)=true`);
  consistent with the zero-tolerance `cleared == declared` rule; no money moved.
- **[nit — now fixed]** `unlinkPaymentFromSlip` now has a direct integration test (membership removed, slip
  recomputed to 0, re-link freed, zero invoice/payment money mutation, `deposit_slip.payment_unlinked` audited).
- **[nit]** public i18n mentions billing vocabulary as feature copy only — no revenue figures/amounts (permitted).

## 9. Known limitations
- **Finance operational UI is French-only** (new `finance` namespace, like `billing`/`receipt`/`cashierReport`) — the
  accepted operational-i18n deferral. `nav` labels + the demo-guide finance step ARE bilingual.
- **Revenue statement number** is `HRB-DEMO-ETAT-2026-000042` (no month segment); Step-0 §4's example shows a month —
  a Unit-5 numbering refinement noted for later (schema/enum already present).
- **DepositSlipPayment `@@unique([hospitalId, paymentId])`** is the contract-literal all-rows unique; freeing a payment
  from a disputed slip hard-deletes the membership row (kept as a Unit-4 decision from the Unit-1 review).
- Bank statement lines are **synthetic** (`isMock`); no real bank feed (by design).

## 10. Production migration checklist (operator-only — do NOT run without explicit operator confirmation)
Apply the additive migration to Neon **before** this code merges (Step-0 §2d — migrate-before-code):
- [ ] **1. Back up / snapshot Neon first** (branch snapshot or `pg_dump`) — recoverable rollback point.
- [ ] **2. Point `DATABASE_URL` at the Neon DIRECT (non-pooler) URL** (not the pooled connection).
- [ ] **3. `prisma migrate deploy` ONLY** — applies the reviewed additive migration; the new `SequenceType`
      values are unused in-migration → transaction-safe on PG15/16.
- [ ] **4. NO `db push`.**
- [ ] **5. NO reset / `--force` / drop.**
- [ ] **6. Post-migration verification:** confirm the 4 tables exist (`\dt "DepositSlip" "DepositSlipPayment"
      "BankStatementLine" "BankReconciliationMatch"`), the 2 `Payment` columns (`mobileMoneyOperator`,
      `mobileMoneyReference`), the 2 new `SequenceType` enum values, and the 5 FCFA CHECK constraints. Capture
      before/after `\dt`.
- [ ] **7. `db:seed:demo` is OPTIONAL and only after explicit operator confirmation** (synthetic demo data;
      never required for the migration itself).
- [ ] **8. Only after Neon is verified:** ff-merge → push `deploy` → manual Vercel Promote → live-verify. The
      schema-dependent code never reaches prod before its tables exist.

### Reference sequence
The additive migration must be applied to Neon **before** this code merges (Step-0 §2d — migrate-before-code):
1. **Review** `migration.sql` (this package §2). It is additive (new enums/values/columns/tables + CHECKs); zero data loss.
2. Point `DATABASE_URL` at the Neon **direct (non-pooler)** URL. Do **not** use `db push`, `--force`, or reset.
3. Run `prisma migrate deploy` (applies only the reviewed additive migration). Capture before/after `\dt`.
   The two new `SequenceType` values are not used in-migration → transaction-safe on PG15/16.
4. Optionally `db:seed:demo` on the demo DB to populate the finance screens (synthetic).
5. **Only after** the Neon migration is confirmed: ff-merge `feature/…` → `deploy/santegrid-webdemo`, push, then the
   manual Vercel **Promote to Production**, then live-verify. The finance code never reaches prod before its tables exist.

## 11. Neon safety confirmation
Every DB operation in this phase targeted **localhost** (`hmis_cameroon` / `hmis_cameroon_test`). **No `migrate deploy`,
no `db push`, no reset, no connection to Neon.** Nothing merged; nothing pushed. `origin/deploy/santegrid-webdemo`
unchanged at `0caf1dcc`.
