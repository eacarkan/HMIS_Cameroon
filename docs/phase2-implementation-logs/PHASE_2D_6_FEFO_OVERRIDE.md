# Phase 2D-6 — FEFO Enforcement & Pharmacist-in-Charge Override

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-6-fefo-override` (stacked on 2D-5 `c9a7ec2`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · FEFO is the default · an override may NEVER pick an expired lot (expired-stock handling is the dual-validated 2D-7 flow) · no MAR / external integration.

## 1. Objective
FEFO (first-expiry-first-out) is **already the default**: reservations are allocated earliest-expiry-first (2D-4) and dispensing consumes those reservations (2D-5). 2D-6 adds the **only sanctioned way to deviate** — the **Pharmacist-in-Charge** re-points an active reservation off its FEFO lot onto a deliberately chosen, non-expired lot, with a **mandatory reason**, recorded durably and audited as `fefo.override`.

## 2. Schema (additive — migration `…_phase2d6_fefo_override`)
- **`StockReservation`** += `isFefoOverride` (Boolean, default false), `overrideReason` (String?), `overrideById` (String?), `overrideAt` (DateTime?). No drops/renames. Default (FEFO) reservations leave these false/null.

## 3. Behaviour (the override path)
- **Read (`dispense.read`):** `getReservationOverrideOptions` returns each ACTIVE reservation with its current lot, whether that lot is the FEFO choice (`isCurrentFefo`), and the alternative lots the chief could pick (same medication, **not expired**, enough available-to-reserve, not the current lot).
- **Override (`fefo.override`, Pharmacist-in-Charge ONLY):** `overrideReservationBatch` validates the target (pure `validateFefoOverride`: same medication, not expired, enough available, differs from current, reason mandatory) then **atomically** (one `$transaction`) moves the hold — increment the chosen lot's `quantityReserved` (optimistic guard: only if its reserved count is unchanged since validation), decrement the source lot's, and re-point the reservation, stamping `isFefoOverride/overrideReason/overrideById/overrideAt`. Concurrent changes abort rather than over-reserve. Audit `fefo.override` (medication, from-lot [FEFO, expiry] → to-lot [expiry], quantity, reason).
- **Dispensing (2D-5) then consumes the chosen lot** — the reservation now points to it, so no change to the dispense path was needed.

## 4. RBAC + audit
- New capability **`fefo.override`** granted to **`pharmacien_chef` ONLY** — a regular `pharmacien` follows FEFO and cannot override; admin/director/doctor/cashier cannot either. Reading the reservations/override options needs `dispense.read` (pharmacy + oversight).
- Audit: `fefo.override` (+ French label "Dérogation FEFO (lot non prioritaire)"). Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/stock.ts`: `fefoBatchId` (earliest-expiry non-expired lot that can cover a quantity) + `validateFefoOverride`. `server/db/reservations.ts`: `findReservationById`, `overrideReservationBatch` (the transactional hold-move). `server/services/fefo-service.ts`: `getReservationOverrideOptions`, `overrideReservationBatch`. `server/actions/fefo-actions.ts`.
- UI: the ordonnance page's **pharmacy card** now shows a **Réservations & FEFO** panel (`components/pharmacy/reservation-override.tsx`) — each active reservation with its lot + a FEFO / Hors FEFO / Dérogation badge; the Pharmacist-in-Charge gets a per-reservation batch picker + reason + "Déroger (FEFO)". Fr (`fefo`); English falls back to the French base (sparse-overlay i18n, as for `dispense`/`stock`).

## 6. Tests + results
- **Unit (`stock`):** `fefoBatchId` (earliest non-expired covering lot / skips short / null) + `validateFefoOverride` (reason / same-lot / wrong-med / expired / insufficient). **`rbac`:** `fefo.override` is chief-only.
- **Integration (`fefo-2d6`):** chief re-points the hold off the FEFO lot (reserved moves, audited, durable flags set); after an override **dispensing consumes the CHOSEN lot** not the FEFO lot; **RBAC** (a regular pharmacist cannot override); rejects same-lot / missing-reason / **expired** target (and the expired lot is not even offered as a candidate).
- **Component (`reservation-override-2d6`):** FEFO badge + override control for the chief; control hidden for non-chief; an overridden reservation shows its reason.
- **E2E (`pharmacy-fefo-2d6`):** doctor prescribes a stocked medication → Pharmacist-in-Charge overrides the FEFO lot with a reason → the **Dérogation FEFO** badge appears. Sorts after the golden path + 2D-5 journey; selects the seeded `Paracétamol 500 mg` explicitly.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · FEFO is the default · **override = Pharmacist-in-Charge only, mandatory reason, audited** · an override may never pick an expired lot · integer quantities · hospital-scoped · additive schema.

## 9. Adversarial-review hardening (fixed before commit)
The pre-commit adversarial review (10-agent Workflow, 4 dimensions) confirmed 5 findings; the genuinely 2D-6-specific ones were fixed:
1. **Prescription-ownership not validated (major + minor).** The override service took only `reservationId` and the action never forwarded `prescriptionId`, so a tampered `reservationId` from a different prescription (same hospital) could be re-pointed. **Fix:** the action now passes `prescriptionId`; the service loads the prescription (`findPrescriptionById` — must exist, not soft-deleted) and rejects a reservation whose `prescriptionId` does not match — matching the `dispensePrescription`/`confirmPrescriptionPayment` ownership pattern. New integration test for the cross-prescription attempt.
2. **Source-batch decrement lacked an optimistic guard (minor).** The target increment was guarded but the source decrement was unconditional. **Fix:** the source decrement is now guarded (`quantityReserved >= quantity`); a concurrent change aborts the transaction with a clear message instead of relying on the CHECK constraint's generic error. Symmetric with the target guard.
3. **Audit written after the transaction commits (major) — NOT changed (deliberate).** This is the **consistent, mentor-accepted pattern across the whole codebase** (2C cancellation/refund, 2D-5 dispensing all record audit after the data write). Making 2D-6 alone wrap its audit in the transaction would diverge from every other unit without addressing the systemic choice; a transactional-audit change, if wanted, belongs in a dedicated codebase-wide pass. Recorded here as a known, accepted limitation.

## 10. Confirmation
This is Phase 2D-6 only. Expired-stock removal and the dual-validated **stock adjustments** (pharmacien requests → pharmacien_chef approves) are 2D-7; pharmacy **reporting** is 2D-8; neither is implemented here.
