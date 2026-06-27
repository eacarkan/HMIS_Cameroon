# Step 9 — Billing / payment

**Date:** 2026-06-27 · **Planning:** 06 §12, 05 §9, 07 §8

## Implemented
- **Billing data-access** (`server/db/invoices`): create invoice + items (one write),
  find-by-id (items, payments, encounter→patient), create payment, update invoice
  status, plus receipt helpers for Step 10. Integer FCFA throughout.
- **Billing service** (`billing-service`): `createInvoice` (authorize `invoice.create`,
  line items from the fake tariff catalogue, total = Σ line totals, number
  `HRB-DEMO-F-2026-000001`, audit `invoice.create`); `recordPayment` (authorize
  `payment.record`, validate amount ≤ remaining, number `HRB-DEMO-R-2026-000001`, status
  → `partially_paid`/`paid`, audit `payment.record`); `invoiceBalance` helper. The
  invoice is the single source of truth for amounts.
- **UI**: invoice creation from the encounter (tariff quantities + live total);
  invoice/payment view (`/factures/[id]`) with line items, total/paid/remaining,
  **Encaisser** payment form (montant + mode de paiement), payment list, and
  **Imprimer le reçu** once paid.
- Fake `TARIFFS` + `PAYMENT_METHOD_FR` in `lib/constants`.

## Verified
Reconciliation (09 §11): invoice total = Σ line items = payment = **3 000 FCFA**,
remaining 0, status **paid**. Numbers `HRB-DEMO-F/R-2026-000001`. Full audit chain
matches 07 §11 (…invoice.create → payment.record "Paiement enregistré (3 000 FCFA,
espèces)"). build/lint/typecheck ✓.
