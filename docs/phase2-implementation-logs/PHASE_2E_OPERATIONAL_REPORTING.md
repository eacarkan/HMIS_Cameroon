# Phase 2E — Operational Reporting + DHIS2-aligned Manual CSV Export

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2e-operational-reporting` (stacked on 2D-8 `d4fe88f`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **AGGREGATE ONLY — no patient identifiers in any report or export** · **no DHIS2 API** (manual CSV only) · no BI/warehouse · central multi-hospital is Phase 3.

## 1. Objective
Hospital-level **operational reports** (aggregate) + a **DHIS2-aligned monthly CSV export** mapped to standard age/gender bands and ICD-10 diagnosis codes, for **manual** upload to DHIS2. The DHIS2 direct API is deferred (Phase 4).

## 2. Schema (additive — migration `…_phase2e_report_export`)
- New model **`ReportExport`** (kind, periodLabel, periodStart/End, rowCount, exportedById) — an **export-history** log. It records WHAT aggregate export ran and BY WHOM; it never stores exported patient data (the exports are aggregate-only). No drops/renames.

## 3. Behaviour (read-only aggregations + export)
- **Operational report (`report.operational.read`):** for a calendar month — consultation count, **age/gender tally** (standard epidemiological bands × M/F/U), **Top-10 diagnoses** (ICD-10 subset), **revenue** total + by payment mode, a **pharmacy snapshot** (when the viewer may read stock), and the **export history**. Demographics (DOB / estimated age / sex) are read ONLY to compute bands and are never emitted.
- **DHIS2 CSV export (`report.export`):** builds aggregate rows `period, orgUnit (hospital code), dataElement (CONSULTATIONS or DIAG:<icd10>), ageBand, gender, value` — **strictly non-nominative by construction** (the row type has no patient field). UTF-8 BOM + CRLF. Records a `ReportExport` (row count) and audits `report.exported_csv` (period + scope + row count only). Returned via a download route.

## 4. RBAC + audit
- New capabilities **`report.operational.read`** (administrateur + directeur) + **`report.export`** (administrateur only — the director has read-only oversight, no export). The cashier keeps `cashier.report.read` (financial); clinicians/reception have neither. Cross-hospital denied (every query is `ctx.hospitalId`-scoped).
- Audit: **`report.exported_csv`** (+ French label). Hospital-scoped; append-only. Read views are not audited (aggregate, non-sensitive; avoids log noise) — documented choice.

## 5. Service / UI
- Pure `lib/dhis2.ts` (AGE_BANDS, ageBand, genderCode, patientAgeYears, Dhis2Row, `buildDhis2Csv` with BOM + zero-drop) + `lib/reporting.ts` (monthPeriod, parseMonthParam, monthLabel, topDiagnoses). `server/db/operational-reports.ts` — least-privilege `select` reading ONLY DOB/estimated-age/sex + diagnosis code/label (never a name/number/phone). `server/services/operational-report-service.ts` (`getOperationalReport`, `exportDhis2Csv`).
- UI: **`/rapports`** — period selector, **"aggregate, no patient data" notice**, KPIs, age/gender table, Top-10 diagnoses, revenue by mode, pharmacy snapshot, export history + an **Export DHIS2 CSV** button → **`/rapports/export`** download route. Nav "Rapports opérationnels" (`report.operational.read`). Fr `operationalReport` namespace; English falls back to base.
- **`scripts/check-privacy.ts` hardened:** statically asserts the DHIS2 export path (`lib/dhis2.ts`, the export service, its data-access) references **no** patient-nominative field and that the CSV header is the strict aggregate column set.

## 6. Tests + results
- **Unit (`reporting-2e`):** banding, gender codes, age-from-DOB/estimated, the CSV header is strictly aggregate (no patient column) + BOM + zero-drop; period math; Top-N diagnoses. **`rbac`:** admin reads+exports, director reads only, others none.
- **Integration (`operational-report-2e`):** consultations/age-gender/Top-10 aggregation; the **DHIS2 CSV contains NO patient name** + the export is recorded in history + audited (period/scope/row-count, no patient data); RBAC (admin/director read, admin-only export).
- **E2E (`rapports-operationnel-2e`):** the admin views the report + downloads the CSV (verified aggregate header, no email/nominative token); reception is redirected and gets 403 on the export.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · **check:privacy ✓ (incl. the export no-identifier assertion)**.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **aggregate-only, NO patient identifiers** in any report/export · **no DHIS2 API** (CSV only) · no patient-level export · no BI/warehouse · central multi-hospital = Phase 3 · additive schema · hospital-scoped · bilingual keys.

## 9. Adversarial-review hardening (fixed before commit)
The pre-commit adversarial review (12-agent Workflow; privacy as the #1 dimension) confirmed 6 findings. The privacy guarantee held (no path leaks an identifier); the three majors were fixed:
1. **Unvalidated ICD-10 codes in the CSV (major).** `buildDhis2Rows` exported any non-empty diagnosis code, so a free-typed/malformed code could corrupt the DHIS2 import. **Fix:** the export now emits only diagnoses whose code exists in the `DiagnosisCode` ICD-10 reference (`listActiveDiagnosisCodes`); others are excluded.
2. **`ageInYears` used local-time accessors on UTC dates (major).** Age banding could shift by one band at a birthday boundary on a non-UTC server. **Fix:** `lib/dates/ageInYears` now uses UTC calendar fields (a DOB is a calendar date) — banding is timezone-stable. Existing `dates` tests still pass.
3. **E2E did not structurally verify the no-PII guarantee (major).** **Fix:** the e2e now asserts EVERY CSV data row is strictly aggregate (exactly six columns, gender ∈ {M,F,U}, integer value) against the accumulated patient data — a leaked patient name could not fit the shape.

Plus the three minor test-coverage gaps were closed: **cross-hospital isolation** (a HRN-NGA consultation is invisible to the HRB-DEMO report), **empty month** (zero counts + a header-only CSV, no throw), and a **consultation without a diagnosis** (counted in CONSULTATIONS, no DIAG row).

## 10. Confirmation
The CSV is **aggregate-only with no patient identifiers** (period / org-unit / data-element / age-band / gender / count), and the DHIS2 **API remains deferred** (manual upload). "Go-live" = synthetic-data UAT. This completes the Phase 2 core (2A → 2E); 2F–2J are optional later extensions.
