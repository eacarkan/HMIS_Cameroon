# Phase 1A — Batch 3 Implementation Log — Billing / cashier strengthening

**For:** mentor review · **Data:** fake/demo only · **Status:** committed (not pushed)
**Branch:** `feature/phase1a-batch-3-billing-cashier` · **Commit:** `e42dc0f` (parent `8ed1dd6`)

## 1. Objective
Add financial-integrity controls (void/cancel, receipt reprint/void marking, cashier shift closing, totals by mode, report filters, export hardening) — **preserving the immutable InvoiceItem snapshot rule**.

## 2. Schema / migration decision
**No schema change, no migration.** The existing enums already carry every needed state: `InvoiceStatus.cancelled`, `PaymentStatus.cancelled`, `Payment.printedAt`, and the four `PaymentMethod` values. **Shift closing is computed (reproducibly) from recorded payments + an audit event — NOT a persisted model**, so the stop-and-propose condition was not triggered.

## 3. Files changed
- **New:** `lib/billing-rules.ts` (void rule + totals-by-mode), `components/billing/cashier-controls.tsx` (void form, close-shift button), tests (`tests/unit/billing-rules.test.ts`, `tests/component/cashier-controls.test.tsx`, `tests/e2e/shift-cashier.spec.ts`), `docs/batch3-screenshots/`.
- **Modified:** `server/db/invoices.ts` (+`updatePaymentStatus`), `server/db/index.ts`, `server/services/billing-service.ts` (+`voidInvoice`), `server/services/receipt-service.ts` (reprint detection), `server/services/reports-service.ts` (method filter, totals-by-mode, shift summary/close, CSV BOM), `server/services/audit-service.ts`, `server/services/index.ts`, `server/actions/billing-actions.ts` (+`voidInvoiceAction`, `closeCashierShiftAction`), `components/print/receipt-document.tsx` (void/reprint banners), `app/(app)/factures/[id]/page.tsx`, `app/(app)/recus/[id]/page.tsx`, `app/(app)/rapports-caisse/page.tsx` + `export/route.ts`, `lib/constants/index.ts`, `messages/fr.json`, `tests/integration/billing.test.ts`.

## 4. Services changed
`voidInvoice(reason)` sets the invoice `cancelled`, cancels its recorded payments, leaves InvoiceItems untouched, audits with the reason; `recordReceiptPrint` distinguishes first print (`receipt.print`) from reprint (`receipt.reprint`); `getCashierDailyReport` gains a method filter + `byMethod` totals (voided payments excluded); `getCashierShiftSummary` / `closeCashierShift` (totals by mode, audited); CSV export adds a UTF-8 BOM + CRLF.

## 5. UI changed
Invoice page: void-with-reason form (+ "Facture annulée" notice). Receipt: "RÉIMPRESSION — DUPLICATA" / "REÇU ANNULÉ" banners. Cashier report: payment-mode filter, totals-by-mode card, "Ma caisse" shift card with "Clôturer la caisse".

## 6. RBAC changes
None added — void uses `invoice.create`; shift close uses `payment.record` (so the read-only director cannot close); reporting uses `cashier.report.read`. Hospital-scoped throughout.

## 7. Audit changes
New actions `invoice.void` ("Annulation de facture"), `receipt.reprint` ("Réimpression de reçu"), `cashier.shift_close` ("Clôture de caisse"), all French-labelled. Void records the reason; shift close records totals by mode.

## 8. Tests run + results
typecheck ✓, lint ✓, build ✓; unit+component **83** (+9); integration **77** (+6); e2e **14** (+1); smoke GOLDEN PATH PASSED; check:arch ✓; check:privacy ✓. Verified: void cancels invoice+payments and **keeps InvoiceItem snapshots unchanged**; voided payments excluded from report; method filter + byMethod totals; shift close audited; CSV BOM-prefixed.

## 9. Screenshots (fake data)
`docs/batch3-screenshots/`: `01-report-by-method.png`, `02-shift-closed.png`, `03-voided-invoice.png`.

## 10. Known issues / notes
Voiding cancels associated recorded payments (so reports/receipts reflect the void); a voided invoice hides the "print receipt" shortcut, so the voided-receipt banner is exercised via the component test. E2E `shift-cashier.spec.ts` is named to sort after the golden path and switches cashier role via `clearCookies`.

## 11. Boundaries respected
Fake data only; no real-data/production authorization; **no external payment gateways, insurance/mutuelle, or external accounting integration** (Phase 4); InvoiceItem snapshots never rewritten; no schema/migration; integer FCFA via `lib/money`; per-hospital `Sequence`; layering + arch/privacy guardrails intact; contract/admin folders untouched.
