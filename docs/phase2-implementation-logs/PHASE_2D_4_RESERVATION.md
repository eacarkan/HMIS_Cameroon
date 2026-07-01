# Phase 2D-4 — Reservation from Prescription

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-4-reservation` (stacked on 2D-3 `229157c`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **reservation only — NO `quantityOnHand` deduction** (deduction = Dispense, 2D-5) · no external integration.

## 1. Objective
When a prescription is **sent to the pharmacy**, reserve stock against it (FEFO, earliest expiry first) — raising `quantityReserved` without deducting `quantityOnHand` — and provide the **48h non-collection release** plus release-on-cancellation.

## 2. Schema (additive — migration `…_phase2d4_stock_reservation`)
- **`ReservationStatus`** enum `active / released / consumed`.
- **`StockReservation`** — prescriptionId, prescriptionItemId, medicationId, **batchId**, integer `quantity`, status, releasedAt?/consumedAt?. Relations on Hospital / Prescription / PrescriptionItem / MedicationStockBatch. `@@index([hospitalId, status, createdAt])` (48h sweep). No drops/renames.
- Atomic `incrementStockBatch(id, { quantityOnHand?, quantityReserved? })` added to the stock data layer (Prisma `{ increment }`) — used for reserve/release/dispense so concurrent deltas are race-safe.

## 3. Behaviour
- **Reserve (on `sendPrescriptionToPharmacy`):** for each prescription line, FEFO-allocate (`lib/stock.allocateFefo` over `availableToReserve = onHand − reserved`) across the medication's batches, create `StockReservation` rows and **increment `quantityReserved`** (on-hand untouched). A shortfall (stock < requested) reserves what's available and is reported in the audit summary (Dispense handles partial). Audit `reservation.created`.
- **Release on cancel (`cancelPrescription`):** all active reservations are released — `quantityReserved` decremented, status `released`. Audit `reservation.released`.
- **48h sweep (`releaseStaleReservations`, `now` injectable):** releases active reservations older than 48h (paid-but-not-collected) — deterministic + testable. Audit `reservation.released`.
- `consumed` status is reserved for Dispense (2D-5).

## 4. RBAC + audit
- The reserve/release-on-cancel are side-effects of already-authorized prescription transitions (no extra capability). The **manual 48h sweep** requires **`reservation.release`** (pharmacien, pharmacien_chef, administrateur).
- Audit: `reservation.created`, `reservation.released` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- `lib/stock.allocateFefo` (pure FEFO allocator over a caller-supplied availability fn); `server/db/reservations.ts`; `reservation-service.ts` (reserve / release-for-prescription / release-stale / list); hooked into `prescription-service` send + cancel.
- UI: a **"Libérer les réservations échues (48h)"** button on `/pharmacie/stock` (`reservation.release`-gated); the stock summary's **Reserved** column now reflects live reservations.

## 6. Tests + results
- **Unit:** `allocateFefo` (earliest-first, spill-over, shortfall, skip-unavailable); `rbac` (+`reservation.release`).
- **Integration (`reservation-2d4`):** send → FEFO reservation on the earliest-expiry lot, **on-hand NOT deducted**; spill-over + shortfall reporting (800 vs 700 seeded); cancel → released (reserved returns to 0); 48h sweep releases a back-dated reservation (deterministic) while a recent one is untouched; RBAC (doctor cannot run the sweep).
- **Component:** the 48h-release button.
- Seed `clearOperationalData` now deletes reservations before prescriptions/stock (FK).

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **186** (136 + 50) · integration **156** · build ✓ · e2e **26** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **reserve-then-dispense (no on-hand deduction here)** · FEFO reservation · 48h release deterministic/testable · integer quantities · hospital-scoped · bilingual keys · additive schema.

## 8. Confirmation
This is Phase 2D-4 only — reservations raise `quantityReserved`; `quantityOnHand` is never deducted here (Dispense = 2D-5). FEFO override (2D-6) and dual-validated adjustments (2D-7) are not implemented. The deeper adversarial review runs at 2D-5 (the on-hand-deduction unit), which exercises the full reserve→dispense path including this reservation logic.
