# Phase 6.6 · Unit 1 — Finance schema / migration + seed support (mentor review evidence)

**Branch:** `feature/phase6-6-unit1-finance-schema-seed` (from `deploy/santegrid-webdemo` = `0caf1dcc`)
**Scope:** schema/migration + seed support + tests ONLY. No services, no UI, no reconciliation/aging/statement screens.
**Contract:** `03_Software/Prompts/Phase_6_6_Step0_Plan.md` (accepted Step-0).

## 1. Migration (additive, one migration for all Phase 6.6 schema)

`prisma/migrations/20260705120000_phase6_6_finance_reconciliation/migration.sql` — **fully additive** (no
DROP / RENAME / retype / SET NOT NULL on any existing column). Contents:

- **Enums:** `DepositSlipStatus{prepared,deposited,cleared,disputed}`, `BankLineMatchStatus{unmatched,matched,disputed}`.
- **`ALTER TYPE "SequenceType" ADD VALUE`** `deposit_slip`, `revenue_statement` (the latter is unused until
  Unit 5 but ships here so ALL Phase 6.6 schema is one migration, per Step-0 §8.5). New values are not used
  in the migration → safe inside `migrate deploy`'s transaction on PG12+ (Neon PG15/16).
- **`ALTER TABLE "Payment" ADD COLUMN`** `mobileMoneyOperator TEXT`, `mobileMoneyReference TEXT` (both NULLABLE
  metadata snapshots — never money fields).
- **Four tables:** `DepositSlip`, `DepositSlipPayment`, `BankStatementLine`, `BankReconciliationMatch` — all
  hospital-scoped (`hospitalId` + FK + `@@index`), soft-deletable (`deletedAt`), integer FCFA.
- **Raw-SQL CHECK constraints** (money invariants not expressible in schema.prisma; mirrored in
  `scripts/setup-test-db.ts`, per the 4G / 2D-5 precedent): `DepositSlip.declaredTotalFcfa/computedPaymentTotalFcfa/clearedAmountFcfa >= 0`,
  `BankStatementLine.amountFcfa >= 0`, `BankReconciliationMatch.matchedAmountFcfa > 0`. `varianceFcfa`
  (declared − computed) is intentionally unconstrained (may be negative).

Generated via `prisma migrate diff --from-config-datasource --to-schema` (canonical additive diff).
**Drift check:** `prisma migrate diff … --exit-code` → *No difference detected* (exit 0) — the migrated DB
matches `schema.prisma` exactly.

### Applied to (local + test only; Neon untouched)
- LOCAL `hmis_cameroon` (localhost) — applied via `psql` (autocommit; not `db push`, not a reset).
- TEST `hmis_cameroon_test` (localhost) — same.
- **Production Neon: NOT touched.** Operator applies via `prisma migrate deploy` (manual step, Step-0 §2d/§2e).

## 2. Prisma schema diff summary

`schema.prisma` +176/−0 lines: 2 enums, 2 `SequenceType` values, 2 nullable `Payment` columns +
`depositSlipLinks` back-relation, 4 new models, 4 new `Hospital` back-relations. `createdById`/`updatedById`
kept as bare `String?` (dominant repo pattern — no new `User` back-relations). `lib/numbering` gained
`deposit_slip → BV` and `revenue_statement → ETAT`.

## 3. Generated model summary

| Model | Purpose | Key fields / constraints |
|---|---|---|
| `DepositSlip` | Bordereau de versement | `slipNumber` (`@@unique([hospitalId, slipNumber])`), `status`, `declaredTotalFcfa`, `computedPaymentTotalFcfa`, `clearedAmountFcfa`, `varianceFcfa` |
| `DepositSlipPayment` | Slip ↔ Payment link | `@@unique([hospitalId, paymentId])` (a payment on ≤1 slip), FK→Payment RESTRICT, FK→DepositSlip Cascade |
| `BankStatementLine` | Synthetic bank line (`isMock`) | `amountFcfa`, `matchStatus`, `importBatchId` |
| `BankReconciliationMatch` | Reconciliation act | `matchedAmountFcfa (>0)`, FK→line + FK→slip |

## 4. Domain rules encoded now (pure `lib/finance`, for the Unit-4 services)

`lib/finance/index.ts` (DB-free, unit-tested): `canTransitionDepositSlip` (prepared→deposited→cleared;
`disputed` exception from any live state; no skips; cleared only when reconciled; no un-clear except disputed),
`canMatchBankLine` (rejects over-match + non-positive; exact fill allowed), `depositSlipReconciles` (zero
tolerance), `depositSlipVarianceFcfa`, `bankLineMatchStatusFor`, `isSameHospital`/`assertSameHospital`.

## 5. Seed impact (synthetic, additive, idempotent)

`scripts/seed-demo-finance.ts` (`seedDemoFinance`, factored out for testability) + arrears block in
`scripts/seed-demo.ts`. A full `npm run db:seed:demo` on the local DB produced (HRB-DEMO):

- **MoMo snapshots backfilled:** 17 `mobile_money` payments tagged (MTN=9 / ORANGE=8) — metadata only.
- **Deposit slips:** 4 — one per lifecycle state: `prepared` (v=0), `deposited` (v=0), `cleared` (v=0,
  cleared=declared, reconciled + 1 bank match), `disputed` (declared 19000 vs computed 18000 → **variance +1000**).
- **Slip↔payment links:** 20. **Bank statement lines:** 4 (1 matched 16500, 1 awaiting, 1 mismatch 18500, 1 orphan 7500).
- **Arrears across aging buckets:** 6 outstanding invoices — 0–30 (1), 31–60 (2), 61–90 (1), 90+ (2).
- **Integrity:** 0 non-`recorded` payments; all 20 deposit-linked payments still `recorded` → **zero money mutation**.

Idempotent via a dedicated `demo.seed.phase66finance` sentinel (a re-run is a no-op).

## 6. Tests run (all green)

- **New:** `tests/unit/finance-6_6.test.ts` (11) — transitions, over-match, reconcile gate, cross-hospital, numbering.
  `tests/integration/phase6-6-finance-schema.test.ts` (7) — unique membership, CHECK rejections,
  hospital scoping, seed determinism + idempotency, MoMo metadata-only, **zero invoice/payment money mutation**
  through a hand-built overlay flow AND through the real `seedDemoFinance()` (both snapshot amount/status/
  receipt/totals + `deletedAt` and assert unchanged).
- **Full gate:** typecheck ✓ · lint ✓ · unit+component **504/504** ✓ · integration **362/362** ✓ ·
  `check:arch`/`check:privacy`/`check:release`/`check:i18n` ✓ · `next build` ✓.

## 8. Adversarial review outcome (4 independent reviewers) + follow-ups

Migration/Neon safety, contract conformance, and seed/rules correctness came back **confirmed_ok**. The
money-path reviewer surfaced one **major** test-coverage gap — the mandatory zero-mutation guarantee was
asserted only against hand-built overlay rows, not the shipping seed — now **fixed** (test 5b wraps a real
`seedDemoFinance()` in the money snapshot). Minor hygiene also **fixed**: deterministic `(depositDate,
slipNumber)` tiebreaker and import-batch idempotency guard on the synthetic bank lines; `deletedAt` added to
the money snapshot. Documented, no change (sanctioned by / deferred to later units):

- `DepositSlipPayment.linkedById` / `BankReconciliationMatch.matchedById` realise §1's creator column with
  action-named fields (contract §1 literally names `matchedById`); parents keep a literal `createdById`.
- **Unit 4 decision:** `@@unique([hospitalId, paymentId])` is the contract-literal all-rows unique. Freeing a
  payment from a `disputed` slip (§9) will need either a hard-delete of the membership row **or** a switch to a
  partial unique `WHERE deletedAt IS NULL`. Flagged for the reconciliation service unit.
- **Unit 5 decision:** the numbered monthly revenue statement example in Step-0 §4 shows a month segment
  (`…-ETAT-2026-07-…`); the shared `formatDocumentNumber` currently emits `…-ETAT-2026-000042` (no month).
  Whether the statement number needs a month is a Unit-5 numbering decision (schema/enum already in place).

## 7. Guardrails honoured

Neon untouched · no `migrate deploy` to prod · no `db push` · no prod reset · no Vercel/env change · no
`deploy` push · public pages untouched · no reconciliation/aging/statement UI · overlay is metadata-only
(the only money-recording path stays `recordPayment → recordPaymentTx`, F-01).
