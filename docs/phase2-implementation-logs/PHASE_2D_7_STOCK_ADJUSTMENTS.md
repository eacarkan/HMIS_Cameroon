# Phase 2D-7 — Stock Adjustments (Dual Validation)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-7-stock-adjustment` (stacked on 2D-6 `aa11c72`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · the on-hand change happens ONLY on approval · a reducing adjustment never touches reserved units or drives on-hand negative · no automatic write-offs.

## 1. Objective
Controlled, **dual-validated** stock adjustments: a `pharmacien` REQUESTS an adjustment against a batch (count correction up/down, loss/damage, or expired-stock removal) with a mandatory reason; the `pharmacien_chef` APPROVES (on-hand changes) or REJECTS (no change). Requester ≠ approver — the same separation-of-duties model as the 2C cancellation flow.

## 2. Schema (additive — migration `…_phase2d7_stock_adjustment`)
- New enums **`StockAdjustmentType`** (`increase` / `decrease` / `loss` / `expiry`) + **`StockAdjustmentStatus`** (`requested` / `approved` / `rejected`).
- New model **`StockAdjustment`** (batchId, medicationId, type, positive `quantity` magnitude, reason, status, requestedById, decidedById?, decisionReason?, decidedAt?) with back-relations on Hospital / Medication / MedicationStockBatch / User (requestedBy + decidedBy). No drops/renames.

## 3. Behaviour (the dual-validation path)
- **Request (`stock.adjustment.request`, pharmacien):** validates type + positive integer quantity + mandatory reason; a REDUCING request is refused up-front if it exceeds the batch's AVAILABLE (`on-hand − reserved`) — reserved units are protected. Creates the request (`requested`). Audit `stock.adjustment_requested`.
- **Approve (`stock.adjustment.approve`, pharmacien_chef):** enforces requester ≠ approver and `requested` status, then applies the change **atomically** (one `$transaction`): claim the request (`requested → approved`, guarded so a double-approve loses), then for `increase` add to on-hand, or for a reducing type re-check AVAILABLE then decrement with an optimistic guard. The DB CHECK (on-hand ≥ 0) is the backstop. Audit `stock.adjustment_approved`.
- **Reject (`stock.adjustment.approve`, pharmacien_chef):** mandatory decision reason; sets `rejected`; NO stock change. Audit `stock.adjustment_rejected`.

## 4. RBAC + audit
- New capabilities **`stock.adjustment.request`** (pharmacien) + **`stock.adjustment.approve`** (pharmacien_chef). The pharmacist cannot approve; the chief cannot self-request — clean dual validation (mirrors cashier-requests / admin-approves in 2C). Reading the worklist needs `stock.read` (pharmacy + oversight).
- Audit: `stock.adjustment_requested` / `_approved` / `_rejected` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/stock-adjustment.ts` (STOCK_ADJUSTMENT_TYPES, isStockReducingAdjustment, adjustmentDelta, validateAdjustmentInput, canDecideAdjustment). `server/db/stock-adjustments.ts` (CRUD + `approveStockAdjustmentTx` transactional apply + `rejectStockAdjustmentRow`). `server/services/stock-adjustment-service.ts` (request / approve / reject / list, audited, `isSeparateApprover` reused from `lib/cancellation-rules`). `server/actions/stock-adjustment-actions.ts`.
- UI: the **stock page** gains a "Demander un ajustement" card (batch + type + quantity + reason) for the pharmacist and an **EXPIRED** badge on out-of-date lots; new **`/pharmacie/ajustements`** worklist (status badges + the chief's approve/reject decide forms). Nav "Ajustements de stock" (`stock.read`). Fr `stockAdjustment` namespace; English falls back to the base.

## 6. Tests + results
- **Unit (`stock-adjustment`):** type/quantity/reason validation, signed delta, reducing-type predicate, decide-guard. **`rbac`:** pharmacist requests / chief approves / no cross-grants.
- **Integration (`stock-adjustment-2d7`):** increase → approve raises on-hand (audited); loss → approve lowers it; reject leaves it unchanged; a reducing adjustment cannot exceed AVAILABLE (reserved protected); expired-lot `expiry` removal; a decided adjustment cannot be decided again; RBAC (pharmacist cannot approve, chief cannot request, reception cannot request).
- **Component (`adjustment-forms-2d7`):** request form (batch/type/quantity/reason + the four types) + empty state; chief decide forms (approve/reject).
- **E2E (`pharmacy-adjustment-2d7`):** pharmacist requests a loss → Pharmacist-in-Charge approves (status → Approuvé); reception is redirected from the worklist (RBAC). Sorts after the golden path; small quantity so later pharmacy specs keep stock.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **change on approval only** · requester ≠ approver · reserved units protected · on-hand never negative (app guard + DB CHECK) · integer quantities · hospital-scoped · additive schema.

## 9. Adversarial-review hardening (fixed before commit)
The pre-commit adversarial review (9-agent Workflow, 4 dimensions) confirmed 5 findings; the real ones were fixed:
1. **Reserved-protection race (blocker).** The approval read `quantityReserved` once to compute AVAILABLE, but the guarded decrement pinned only `quantityOnHand` — so a reservation committing between the read and the decrement could grow `reserved` and drive `on-hand < reserved` (available negative). **Fix:** the reducing decrement now pins **both** `quantityOnHand` AND `quantityReserved` to the values the AVAILABLE check validated; any concurrent change matches 0 rows and aborts the transaction (consistent with the 2D-6 override's optimistic guard). New integration test: a reservation made AFTER the request blocks the approval and rolls it back (stock unchanged, status stays `requested`).
2. **Decimal quantity truncation (minor).** The action used `parseInt`, silently turning a direct `"2.5"` POST into `2`. **Fix:** use `Number(...)` so a non-integer stays non-integer and is rejected by `validateAdjustmentInput` (the form already constrains `step=1`).
3. **Cross-hospital isolation test (nit) — not added.** The reviewer confirmed every query is correctly `ctx.hospitalId`-scoped (a forged batchId/adjustmentId from another hospital is simply not found); this is a missing defensive test, consistent with the other 2D pharmacy units (covered by the dedicated scoping-rbac suite), so it is noted rather than added here.

Audit-after-commit remains the consistent codebase pattern (2C/2D-5/2D-6), unchanged.

## 10. Confirmation
This is Phase 2D-7 only. Pharmacy **reporting** (stock levels / low / expiring / dispensing volume — read-only) is 2D-8; operational reporting + the DHIS2 aggregate CSV (no patient identifiers) is 2E; neither is implemented here.
