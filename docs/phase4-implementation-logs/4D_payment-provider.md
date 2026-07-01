# Phase 4D — Payment Provider Abstraction + Reconciliation

**Batch:** 4D · **Branch:** `feature/phase4d-payment` (stacked on 4C) · **Commit message:** `Phase 4D: add payment-provider abstraction and reconciliation foundation`

> **Synthetic data only · NOT Gate 7 · mock only · no real provider API · no production payment.** Doc 39 §3 (4D), §5, §8, Prompt 4D; builds on 4A + Phase 2C billing (manual modes preserved).

## 1. Objective
Model electronic-payment readiness (Mobile Money) via a **provider abstraction + mock provider + reconciliation**. A **mock provider registry**, an `ExternalPaymentTransaction` with a **unique reference** + status machine (`PENDING / CONFIRMED / FAILED / CANCELLED / NEEDS_REVIEW`), and a **reconciliation workflow**. **No real API; no production payment.**

## 2. Schema (additive — §7 rule: proceed + log)
Migration `20260701030000_phase4d_payment_provider` (additive; integer FCFA; no existing-table change):
- **`ExternalPaymentProvider`** (`@@unique[hospitalId, code]`; `isMock` default true) — mock provider registry.
- **`ExternalPaymentTransaction`** (`@@unique[hospitalId, externalReference]` = idempotent; `@@index[hospitalId, status]`) — amount (Int FCFA), status, `invoiceId?`, **`reconciledPaymentId?`** (the CONTROLLED Payment linked at reconciliation — never a direct write).

## 3. THE GUARANTEE — a confirmation never marks an invoice paid; reconcile via the existing rule
- **A mock confirmation NEVER touches the invoice.** `confirmMockPayment` runs the 4A **mock connector** (no network) and a guarded `PENDING → CONFIRMED` status transition only — it creates no `Payment` and does not change invoice status.
- **Reconciliation records a CONTROLLED `Payment` through the EXISTING billing rule** (`recordPayment`) — which validates `amount ≤ remaining`, creates the `Payment` with a receipt number, updates the invoice status, audits `payment.record`, and **preserves the Phase 2C `InvoiceItem` snapshots**. 4D never writes the invoice/payment directly; it only links `reconciledPaymentId` (guarded, once). If the payment cannot be recorded, nothing is linked.
- **Idempotent / guarded:** the transaction reference is unique per hospital; status transitions and the reconcile link are guarded `updateMany` claims (no double-confirm / double-reconcile).

## 4. RBAC / audit
- **Caps** (`lib/rbac`): `external_payment.view` (**caissier** + **administrateur** + **directeur**), `external_payment.reconcile` (**caissier** — finance, who also holds `payment.record`). No clinical access; per-hospital; cross-hospital denied.
- **Audit**: `external_payment.created`, `external_payment.status_changed`, `external_payment.reconciled` (+ the `payment.record` from the controlled path).

## 5. Tests + results (doc 39 §9)
- **unit** `tests/unit/external-payment.test.ts` (3) — provider/transaction validation, status machine (confirm / fail-cancel / reconcile-only-CONFIRMED-and-unreconciled).
- **integration** `tests/integration/phase4d-external-payment.test.ts` (4) — **THE GUARANTEE** (confirm leaves the invoice UNTOUCHED + zero payments; reconcile → a controlled `mobile_money` Payment via the existing rule → invoice `paid`, `InvoiceItem` snapshot preserved, `reconciledPaymentId` set, `payment.record` audited); **guarded reconcile** (cannot reconcile a non-confirmed / reconcile twice); **unique reference dedupe** + **network-egress guard** (confirm makes 0 `fetch` calls); non-finance + cross-hospital denied.
- **component** `tests/component/external-payment-admin-4d.test.tsx` (3) — provider/intent/txn-action forms.
- **e2e** `tests/e2e/integration-payment-4d.spec.ts` (2) — cashier creates a mock provider + intent + confirms (no invoice movement); clinical doctor redirected (RBAC).
- **Suite at this tip:** unit+component **373**, integration **319** (vitest **692**), Playwright **e2e 59** · `build` ✓ · `smoke` ✓ · `typecheck` clean · `lint` 0 errors (1 pre-existing warning) · `check:arch` ✓ · `check:privacy` ✓. Evidence [`docs/qa-command-output/phase4/4D/`](../qa-command-output/phase4/4D/); screenshot [`docs/phase4d-screenshots/`](../phase4d-screenshots/).

## 6. Financial-integrity basis
Reconciliation delegates entirely to the **already-hardened** Phase 2C/3 `recordPayment` (status-guarded, amount-validated, snapshot-preserving, audited) — 4D adds **no** new invoice/payment-mutation code. The mock confirmation is a guarded status transition that provably never touches the invoice (directly tested). This is the safety basis in lieu of a separate adversarial workflow.

## 7. Known issues
None. Pre-existing non-blocking `phase3f1` lint warning.

## 8. Boundary confirmation
Synthetic only · **mock only, no real API/production payment** · **a mock confirmation never silently marks an invoice paid or rewrites history; reconciliation creates/links a controlled payment via the existing billing rule; invoice snapshots preserved** · integer FCFA · finance-gated · hospital-scoped (service + DB) · server-side RBAC · audited · additive schema (§7) · Phase 1A/2/3 golden paths preserved · not Gate 7.

## 9. Files changed
- `prisma/schema.prisma` (+1 enum, +2 models, Hospital back-relations), `prisma/migrations/20260701030000_phase4d_payment_provider/migration.sql`.
- `lib/external-payment.ts`; `lib/rbac/index.ts` (+2 caps); `server/services/audit-service.ts` (+3 actions).
- `server/db/external-payment.ts` + `server/db/index.ts`; `server/services/external-payment-service.ts` + `server/services/index.ts`; `server/actions/external-payment-actions.ts`.
- `app/(app)/facturation/paiements-externes/page.tsx`; `components/admin/external-payment-admin.tsx`; `components/layout/nav.ts` (+nav item); `messages/fr.json` / `messages/en.json` (`externalPayment` ns + nav); `tests/unit/i18n-parity.test.ts` (+`externalPayment`).
- `prisma/seed-data.ts` (reset cleanup); tests (unit/integration/component/e2e); `docs/qa-command-output/phase4/4D/`, `docs/phase4d-screenshots/`.
