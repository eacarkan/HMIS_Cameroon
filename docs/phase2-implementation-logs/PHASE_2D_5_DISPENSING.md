# Phase 2D-5 — Dispensing & Stock Deduction

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-5-dispensing` (stacked on 2D-4 `a779c7c`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **deduction happens ONLY on Dispense** · paid-check enforced (emergency exception deferred to Phase 2H) · no MAR / dose-level administration / external integration.

## 1. Objective
Implement **dispensing**: a paid prescription is collected at the pharmacy, which CONSUMES the FEFO reservations (2D-4) — **deducting `quantityOnHand`** — supports **partial dispensing**, and produces a **printable dispense record**.

## 2. Schema (additive — migration `…_phase2d5_dispensing`)
- **`Prescription`** += `isPaid`/`paidAt`/`paidById` (the cashier confirms the patient paid — the "paid check").
- **`DispenseRecord`** (dispenseNumber, prescriptionId, dispensedById) + **`DispenseRecordItem`** (prescriptionItem → batch, medicationLabel/unit snapshot, integer quantity). `SequenceType` += `dispense` (letter `D`). No drops/renames.

## 3. Behaviour (the deduction path)
- **Confirm payment (cashier, `prescription.payment.confirm`):** sets `isPaid` (idempotent), only on a finalized/sent prescription. Audit `prescription.payment_confirmed`. This is the "paid check" precondition (the patient pays at the cashier, then collects at the pharmacy).
- **Dispense (pharmacy, `dispense.perform`):** REQUIRES `isPaid` + status `sent_to_pharmacy`/`partially_dispensed`. For each line, consumes its **active reservations** (FEFO-chosen at 2D-4): atomically **decrements `quantityOnHand`** and `quantityReserved` by the reserved amount and marks the reservation `consumed`. Writes a `DispenseRecord`, advances the prescription to **`dispensed`** (every line fully served) or **`partially_dispensed`** (a 2D-4 shortfall left some unreserved). Audit `dispense.completed`. Dispensing with no active reservations is rejected (never over-deducts / goes negative — it only consumes existing reservations).
- **Printable dispense record** (`react-to-print`, A4): hospital header, tracking number, prescription reference, dispensed lines (medication + batch + quantity), pharmacist signature space, synthetic marker.

## 4. RBAC + audit
- Capabilities: **`prescription.payment.confirm`** + **`prescription.read`** (caissier — the confirm-payment control lives on the prescription view, so the cashier reads it to confirm; the cashier still CANNOT dispense, which requires `dispense.perform`) + **`dispense.perform`** (pharmacien, pharmacien_chef). Strict segregation: the cashier confirms payment but cannot dispense; the pharmacy dispenses but cannot confirm payment; the doctor has no stock control. The `Délivrance` nav + the `Délivrer` button are gated on `dispense.perform`, so the cashier never sees a dispensing surface.
- Audit: `prescription.payment_confirmed`, `dispense.completed` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- `dispensing-service.ts` (confirm payment, dispense, worklist + record reads); `server/db/dispensing.ts` + `prescriptions.setPrescriptionPaid`/`listPharmacyWorklist`; `dispensing-actions.ts`.
- UI: pharmacy **worklist** `/pharmacie/dispensation` (sent prescriptions + Dispense, paid/unpaid badge); **printable dispense record** `/dispensations/[id]`; the ordonnance page now shows the **payment status + a cashier "Confirmer le paiement" button + dispense-record links**. Nav "Délivrance" (`dispense.perform`). Fr/En (`dispense`).

## 6. Tests + results
- **Unit:** `rbac` (+2D-5 payment/dispense separation).
- **Integration (`dispensing-2d5`):** pay→dispense deducts on-hand + clears reservation + marks dispensed + audited; **unpaid dispense rejected** (paid check); **partial dispensing** (800 vs 700 → on-hand to 0, status partially_dispensed); RBAC (cashier confirms not dispenses, pharmacist dispenses not confirms); a paid-but-unreserved (no stock) prescription cannot be dispensed.
- **Component:** confirm/dispense buttons + the printable dispense record.
- **E2E:** the full **doctor → cashier → pharmacy** journey (prescribe → finalize → send → confirm payment → dispense → printable record).
- **Integration (concurrency):** a **concurrent double-dispense** of the same prescription deducts stock **exactly once**, creates **one** record, and cleanly rejects the loser (validates the atomic guarded-claim).
- Seed `clearOperationalData` deletes dispense records before reservations/prescriptions (FK).
- **Adversarially reviewed** (15-agent Workflow, 4 dimensions: stock integrity, RBAC/privacy, state-machine/partial, test integrity); 11 findings confirmed across **3 root causes** — all fixed before commit (§9).

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · **e2e ✓ (28 specs)** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

> **E2E hardening note.** Three accumulating-DB e2e flakes were diagnosed and fixed as *test-harness* issues (no product bug): (1) `pharmacy-dispense-2d5` now explicitly selects the seeded, stocked `Paracétamol 500 mg` instead of the catalogue-order default — an earlier spec creates a `displayOrder=0` medication that became `medications[0]` with no stock at dispense time; (2) `stock-2d3` asserts on the seeded batch number `LOT-PARA-B` (visible ledger) instead of `"Paracétamol"` which matched the hidden `<option>` of the receive-form select; (3) `shift-cashier` waits for the approve server action to COMMIT (the refund-voucher link appears via `revalidatePath`) before navigating to `/remboursements`, so the hard `page.goto` no longer aborts the in-flight action.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **deduct-on-Dispense only** · paid check enforced (emergency = 2H, deferred) · partial dispensing · cashier ≠ pharmacist · doctor no stock control · integer quantities · hospital-scoped · bilingual keys · additive schema.

## 9. Adversarial-review hardening (fixed before commit)
The pre-commit adversarial review confirmed 11 findings collapsing to **three root causes**, all fixed:

1. **Atomicity / idempotency / concurrency (1 blocker + 3 major + 1 minor).** The dispense loop was a sequence of separate, unguarded writes — a concurrent double-dispense (double-click, retry, two pharmacists) could consume the same reservation twice and double-deduct stock. **Fix:** the whole consume → deduct → record → status transition now runs in **one interactive `$transaction`** in `server/db/dispensing.ts` (`dispenseReservationsForPrescription`); each reservation is **claimed** with a guarded `active → consumed` update, so the loser of a race matches 0 rows and deducts nothing. The cumulative status is computed **inside** the transaction (closing the minor status-race too). New concurrency integration test added.
2. **RBAC too broad (4 major + 1 minor).** The pharmacy worklist and dispense records were gated on `prescription.read` — which the cashier (and doctor/admin/director) hold — leaking operational pharmacy data. **Fix:** new capability **`dispense.read`** (pharmacien, pharmacien_chef, administrateur, directeur). The **worklist** (service + page) now requires `dispense.perform` (pharmacy-only, matching the nav gate); **dispense records** (service + page) require `dispense.read`; the ordonnance page fetches dispense records only when the viewer has `dispense.read` (so the cashier/doctor view is unaffected). RBAC unit tests extended.
3. **Stock could go negative (1 major).** No non-negative invariant on `quantityOnHand`/`quantityReserved`. **Fix (defence-in-depth):** the in-transaction decrement is **guarded** (only deducts when on-hand AND reserved cover the quantity, else the transaction aborts), AND DB-level **CHECK constraints** `quantityOnHand >= 0` / `quantityReserved >= 0` were added — via migration `20260630120000_stock_nonnegative_check` on the migrate path (dev/prod) and via `setup-test-db.ts` on the `db push` test path (the two environments provision differently).

## 10. Confirmation
This is Phase 2D-5 only — FEFO is followed via the 2D-4 reservations; the **FEFO override** (a non-FEFO batch with a Pharmacist-in-Charge reason) is 2D-6, and dual-validated **adjustments** are 2D-7, neither implemented here. Stock is deducted strictly on Dispense.
