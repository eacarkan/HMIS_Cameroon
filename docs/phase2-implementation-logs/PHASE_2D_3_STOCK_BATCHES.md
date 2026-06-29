# Phase 2D-3 — Stock Batches & Expiry

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-3-stock-batches` (stacked on 2D-2 `3bdf8f2`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · batch ledger only (reservation = 2D-4, dispensing/deduction = 2D-5, FEFO = 2D-6, adjustments = 2D-7) · no procurement/barcode/external integration.

## 1. Objective
Add a **batch/expiry stock ledger** for medications — mandatory batch number + expiry date, integer quantities — and a **receive-stock** flow. This is the foundation reservation/dispensing/FEFO build on.

## 2. Schema (additive — migration `…_phase2d3_stock_batches`)
- **`MedicationStockBatch`** — `medicationId`, `batchNumber`, `expiryDate` (`@db.Date`), `quantityReceived`, **`quantityOnHand`** (physical available), **`quantityReserved`** (held by finalized prescriptions, Phase 2D-4; default 0), `receivedById`. `@@index([hospitalId, medicationId, expiryDate])` (FEFO). Integer quantities. Relations on Hospital + Medication. No drops/renames.

## 3. Behaviour
- **Receive (pharmacy, `stock.receive`):** validates the input (`lib/stock.validateStockBatchInput` — medication + batch number + valid expiry + positive integer quantity), checks the medication is active, creates a batch with `quantityOnHand = quantityReceived`, `quantityReserved = 0`. Audit `stock.batch_received` (medication + lot + qty + expiry). Each receipt is its own lot row (FEFO works across lots).
- **Read (`stock.read`):** the batch ledger + a **per-medication summary** (`getStockSummary`: total on-hand / reserved / available + earliest expiry + batch count).
- **Pure helpers (`lib/stock`):** `sortFefo` (earliest expiry first, ties by createdAt/id), `availableToReserve` (= onHand − reserved, never negative), `totalOnHand`/`totalReserved`, `isExpired` — reused by 2D-4/2D-5/2D-6.

## 4. RBAC + audit
- Capabilities: **`stock.receive`** (pharmacien, pharmacien_chef) + **`stock.read`** (pharmacien, pharmacien_chef, administrateur, directeur). Reception/doctor/cashier are not in the stock flow.
- Audit: `stock.batch_received` (+ French label). Hospital-scoped; append-only.

## 5. Service / UI
- `lib/stock.ts`, `server/db/stock.ts` (create/list/FEFO-list/find/adjust), `stock-service.ts` (list + summary + receive), `stock-actions.ts`.
- UI: `/pharmacie/stock` (per-medication summary + batch ledger + receive form when `stock.receive`); nav entry "Stock pharmacie" (`stock.read`-gated). Fr/En labels (`stock`).
- Synthetic seed: 4 stock lots across Paracétamol (two lots — earliest-expiry first for FEFO), Amoxicilline, ACT. Seed `clearOperationalData` deletes stock before medications (FK); `seedStock` is idempotent.

## 6. Tests + results
- **Unit:** `stock` (validation, FEFO ordering, available-to-reserve, totals, expiry); `rbac` (+2D-3 caps).
- **Integration (`stock-2d3`):** seeded ledger; pharmacist receive (audited); invalid-input + inactive-medication rejection; per-medication summary aggregation (Paracétamol 700 on-hand across 2 lots); RBAC (admin reads but can't receive; reception can't read); hospital scoping.
- **Component:** the receive form (fields + button).
- **E2E:** pharmacist receives a batch + sees the seeded ledger; reception is redirected (RBAC).

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **180** (131 + 49) · integration **150** · build ✓ · e2e **26** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **batch ledger only** (no reservation/dispensing/FEFO/adjustment yet) · integer quantities · pharmacy-managed · hospital-scoped · bilingual keys · additive schema.

## 8. Confirmation
This is Phase 2D-3 only — `quantityReserved` exists but is never changed here (reservation = 2D-4); nothing deducts `quantityOnHand` yet (dispensing = 2D-5); FEFO consumption (2D-6) and dual-validated adjustments (2D-7) are not implemented.
