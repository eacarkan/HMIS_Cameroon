# Phase 2D-8 — Pharmacy Reporting (read-only)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-8-pharmacy-report` (stacked on 2D-7 `f18e0e8`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **READ-ONLY** (no mutations, no schema change) · aggregate only — NO patient identifiers in any pharmacy report.

## 1. Objective
A read-only **pharmacy report** over the existing 2D stock + dispensing data: per-medication **stock levels**, **low-stock** lines, **expiring / expired** lots, and **dispensing volume** over a window. Pure aggregation — nothing is written.

## 2. Schema
**None.** 2D-8 only reads existing tables (MedicationStockBatch, DispenseRecord/Item). Thresholds are prototype constants (`LOW_STOCK_THRESHOLD = 50`, `EXPIRY_SOON_DAYS = 90`); a per-medication reorder level would be a later additive change.

## 3. Behaviour (read-only aggregations)
- **Stock levels:** per medication — total on-hand, reserved, available (`on-hand − reserved`), batch count, earliest expiry; a `low` flag when available ≤ threshold.
- **Low stock:** the stock-level rows with `low = true`.
- **Expiring / expired lots:** every batch that still holds on-hand and is expired (≤ now) or expiring within `EXPIRY_SOON_DAYS`, sorted by expiry; far-future lots are excluded.
- **Dispensing volume:** dispensed lines in the last `windowDays` (default 30) aggregated per medication (units + line count) + the distinct dispense-record count + total units. `now`/`windowDays` are injectable for deterministic tests.

## 4. RBAC + audit
- Gated on **`stock.read`** (pharmacy + oversight — pharmacien, pharmacien_chef, administrateur, directeur). No new capability; a read-only report needs no audit event (it changes nothing). Aggregate only — **no patient identifiers** are read or shown.

## 5. Service / UI
- Pure `lib/pharmacy-report.ts` (LOW_STOCK_THRESHOLD, EXPIRY_SOON_DAYS, daysUntil, isLowStock, expiryStatus, aggregateDispensingByMedication). `server/db/pharmacy-reports.ts` (listDispenseItemsSince, countDispenseRecordsSince) + reuse of `listStockBatches`. `server/services/pharmacy-report-service.ts` (`getPharmacyReport`). No action (read-only).
- UI: **`/pharmacie/rapports`** — KPI cards (medications tracked, low-stock, lots to watch, units dispensed) + four tables (low stock, expiring/expired lots, dispensing volume, full stock levels). Nav "Rapports pharmacie" (`stock.read`). Fr `pharmacyReport` namespace; English falls back to the base.

## 6. Tests + results
- **Unit (`pharmacy-report`):** daysUntil, isLowStock (inclusive threshold), expiryStatus (expired/expiring/ok), aggregateDispensingByMedication (per-med sums, descending).
- **Integration (`pharmacy-report-2d8`):** per-medication levels + low-stock flag (a small Métronidazole lot); expiring/expired classification with a far-future lot excluded (injected `now`); dispensing volume after a real dispense; RBAC (reception cannot read).
- **E2E (`pharmacy-report-2d8`):** the pharmacist opens the report (KPIs + levels table + seeded line); reception is redirected. Sorts after the other pharmacy specs so dispensing data has accumulated.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **read-only, no schema change** · aggregate only, **no patient identifiers** · integer quantities · hospital-scoped · `stock.read`-gated.

## 9. Adversarial-review hardening (fixed before commit)
The focused pre-commit review (privacy + aggregation, 3-agent Workflow) confirmed **1 minor**, fixed: `listDispenseItemsSince` used an `include` (returning all `DispenseRecordItem` fields, including the patient-traceable `prescriptionItemId`) even though the report only needs unit/quantity/medication. The final report never exposed it, but least-privilege at the data layer — especially for a privacy-sensitive reporting path and matching `findPaymentsSince` — is the right pattern. **Fix:** the query now uses an explicit `select` returning ONLY `unit`, `quantity`, and the batch's `medicationId` + medication `nameFr`. No patient-traceable field is read. Aggregation correctness was confirmed clean (no off-by-one in expiry/low-stock/window).

## 10. Confirmation
This is Phase 2D-8 only and completes Phase 2D (pharmacy). Operational reporting + the DHIS2 aggregate CSV (no patient identifiers) is **2E** — implemented next.
