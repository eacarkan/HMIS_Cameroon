# Phase 2C — Cashier & Billing Strengthening

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2c-cashier-billing` (stacked on the 2C-ready tip `f5053a8`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real patient data · no production authorization · manual payment modes only (no Mobile Money / external payment API) · no accounting/insurance integration · emergency debt only as extension points (not implemented).

## 1. Objective
Strengthen billing/cashier with a hospital tariff dictionary (effective dates), a controlled **cancellation → admin-approval** workflow with a linked **Refund Voucher**, and a printable **Brouillard de Caisse** (cashier closing) — preserving the InvoiceItem snapshot rule and full append-only audit.

## 2. Schema (additive — migrations `…_phase2c_cashier_billing_strengthening` + `…_phase2c_refund_cancelled_by`)
**Stop-and-propose decision (applied):** four new models + three enums + two `SequenceType` values + two optional `Tariff` columns. No drops/renames; existing Phase 1A billing flows intact.
- **Enums:** `CancellationRequestStatus {requested, approved, rejected}`, `RefundVoucherStatus {requested, approved, paid, cancelled}`, `CashierShiftStatus {open, closed, corrected}`.
- **`SequenceType` += `refund_voucher` (letter `A` — avoir), `cashier_shift` (letter `B` — brouillard).**
- **`Tariff` += `effectiveFrom?`, `effectiveTo?`** (informational; never alter snapshots).
- **`InvoiceCancellationRequest`** — invoiceId, status, reason, requestedById, decidedById, decisionReason, decidedAt. Request and decision are distinct events.
- **`RefundVoucher`** — voucherNumber (unique/hospital), invoiceId, cancellationRequestId (unique), amount (FCFA), status, requestedById/approvedById/executedById + timestamps.
- **`CashierShift`** — shiftNumber, cashierId, status, openingBalance + the five frozen totals + receiptCount, openedAt/closedAt/closedById.
- **`CashierShiftCorrection`** — append-only (cashierShiftId, reason, note, correctedById).
Relations added to Hospital / User / Invoice. `Payment` is unchanged (shift totals are attributed by the cashier's recorded payments within the shift window `[openedAt, closedAt)` — deterministic, no FK churn).

## 3. Behaviour (exact)
### 3.1 Tariff dictionary
Already hospital-scoped + admin-only (`tariff.manage` = `administrateur`), audited, snapshot-preserving. 2C adds optional **effective dates** (create form + action + service). Changing a tariff never alters past InvoiceItems (snapshot is the source of truth).

### 3.2 Cancellation → approval (cashier ≠ approver)
- **Cashier** (`invoice.cancel.request`) requests with a mandatory reason → `InvoiceCancellationRequest(requested)`; audit `invoice.cancellation_requested`. One pending request per invoice; an already-cancelled invoice is rejected.
- **Administrator** (`invoice.cancel.approve`) approves or rejects. **Requester ≠ approver enforced** (`isSeparateApprover`). On **approve**: invoice → `cancelled`, recorded payments → `cancelled` (InvoiceItem snapshots untouched), audit `invoice.cancellation_approved`; if the invoice had recorded payments, a **RefundVoucher** is raised for the collected amount (audit `refund_voucher.created`). On **reject** (mandatory reason): no invoice change, audit `invoice.cancellation_rejected`.
- The old direct `voidInvoice` path was **removed** (a cashier can no longer self-cancel).

### 3.3 Refund Voucher state machine
`requested → approved → paid` (+ `cancelled` from requested/approved); `paid`/`cancelled` terminal (`lib/refund-voucher`). **Admin** approves/cancels (`invoice.cancel.approve`); **cashier** executes the physical cash-out (`refund.execute`) → `paid`. Illegal transitions (e.g. requested→paid, double-execute) are rejected. Each transition audited.

### 3.4 Brouillard de Caisse
- **Open** (`cashier.shift.manage`) with an opening balance (integer FCFA ≥ 0) → numbered `…-B-…`; one open shift per cashier; audit `cashier.shift_opened`.
- **Close** computes the **five mandatory totals deterministically** (`lib/cashier-closing`) — Opening Balance, Total Cash Received, Total Mobile/Card Received, Total Cancellations/Refunds, Expected Closing Balance (= opening + cash − refunds) — and **freezes** them; audit `cashier.shift_closed`. Re-closing is rejected. Only the owner can close.
- **Printable** Brouillard (`react-to-print`, A4) with the official header, the five fields, corrections history, **Chief Cashier signature space**, and the synthetic-data prototype marker.
- **Immutable once closed:** corrections never edit the frozen figures — they append a `CashierShiftCorrection` row and flip the status to `corrected`; audit `cashier.closing_corrected`.

### 3.5 Manual payment modes
Unchanged: `cash | mobile_money | card | bank_transfer` chosen at payment time (no Mobile Money / external API). The Brouillard buckets cash vs mobile/card.

## 4. RBAC changes (capability-based; admin not clinical)
New capabilities: `invoice.cancel.request` (caissier), `invoice.cancel.approve` (administrateur), `refund.read` (caissier/administrateur/directeur), `refund.execute` (caissier), `cashier.shift.manage` (caissier). The administrator approves but cannot request/execute/run a shift; the cashier requests/executes/runs a shift but cannot approve. Cross-hospital denied; every path hospital-scoped.

## 5. Audit changes
Added `invoice.cancellation_requested/approved/rejected`, `refund_voucher.created/approved/executed/cancelled`, `cashier.shift_opened/shift_closed/closing_corrected` (+ French labels). Append-only; actor + hospital + amounts in the summary.

## 6. UI
New pages: `/annulations` (admin worklist), `/remboursements` + `/remboursements/[id]` (refund list/detail), `/caisse/brouillard` + `/caisse/brouillard/[id]` (open/close + printable). The invoice page now shows the cancellation-request state + refund link instead of a direct void. New nav entries (capability-gated). All strings are Fr/En i18n keys.

## 7. Tests + results
- **Unit:** `refund-voucher` (state machine), `cashier-closing` (five-total math, cash/mobile split, refund deduction), `cancellation-rules` (requester≠approver, decide-once, reason), `rbac` (+2C capabilities).
- **Integration (`cashier-billing-2c`):** request→approve→refund voucher (snapshots intact); unpaid → no voucher; reject leaves invoice paid; requester≠approver; duplicate-request guard; RBAC (reception can't request, cashier can't approve); refund state machine (approve→execute, double-execute rejected, cancel); Brouillard open→pay→close (five frozen totals), immutable + correction, own-shift guard, RBAC.
- **Component:** cancellation request form requires reason; open-shift form; refund actions visibility by status; Brouillard print document (five fields + Chief Cashier signature + marker).
- **E2E:** open shift → pay → close Brouillard (printable) → request cancel → admin approve → refund voucher.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **156** · integration **130** · build ✓ · e2e **22** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

**Adversarial review (4 dimensions × verify pass).** Three confirmed findings were fixed before commit (the rest were positive confirmations of correct controls):
1. **`RefundVoucher.cancelledById`** added (+ `cancelledBy` relation; additive migration `…_phase2c_refund_cancelled_by`) so a cancelled voucher names who cancelled it on the record — parity with `approvedById`/`executedById`, not only the audit log.
2. **`correctCashierShift` own-shift guard** — a cashier can correct only their OWN Brouillard (parity with the close guard).
3. **Brouillard immutability hardening** — the generic `setCashierShiftStatus` was replaced by `markCashierShiftCorrected` with a `status: { not: "open" }` guard, so a closed Brouillard can never be reverted to `open` (the frozen figures stay immutable). Tests added for (1) and (2).

## 8. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · manual payment modes only (no Mobile Money/external/accounting/insurance) · invoice snapshots preserved · cashier ≠ approver · admin not clinical · Brouillard immutable-once-closed · additive schema · hospital-scoped · bilingual keys · emergency-debt only as extension points. **"Go-live" = controlled synthetic-data UAT, not real operation.**

## 9. Confirmation
Invoice/InvoiceItem snapshots are intact (cancellation is a controlled state change, never a rewrite). This is Phase 2C only — no pharmacy/prescription (2D), reporting/CSV (2E), or later extensions (2F–2J) were implemented.
