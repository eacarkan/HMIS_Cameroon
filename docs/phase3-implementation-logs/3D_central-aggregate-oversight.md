# Phase 3D — Central Aggregate Oversight (snapshot-fed)

**Unit:** 3D · **Branch:** `feature/phase2h-emergency` · **Commit message:** `Phase 3D: add central aggregate-only oversight (snapshot-fed, no patient-level access)`

> Built only after 3B's scoping was strongly tested (doc 34 §3). Aggregate-only, read-only, audited. Synthetic data only.

## 1. Objective
A **central (national/regional) aggregate-only oversight** view with **no patient-level drilldown** and **no direct central access to operational hospital records**: the central viewer reads **only** per-hospital aggregate snapshots (doc 34 §7).

## 2. Schema decision (additive; stop-and-propose → proceed)
Per §7.7's explicit "create snapshot model **or** reuse" decision, I **created the snapshot model** — required so central never reads operational tables:
- **`HospitalAggregateSnapshot`** (`@@unique([hospitalId, period])`): an aggregate-only `indicators` JSON + `generatedById`. **No nominative field.** Migration `20260630200000_phase3d_aggregate_snapshot` (standard table; no raw SQL → test db-push picks it up).

## 3. Data-flow rule (the core control)
- **Generation is hospital-side**: `generateHospitalAggregateSnapshot` reuses the 2E operational report (gated by `report.operational.read`, hospital-scoped) + a few hospital-scoped counts, and stores **only** aggregate counts/totals (`consultationCount`, `patientCount`, `revenueTotalFcfa`, `revenueByMethod`, `topDiagnoses` = ICD `{code,label,count}`, `emergencyDebtOutstandingFcfa`, pharmacy alert counts, queue/admission/diagnostic counts).
- **Central read is snapshot-only**: `getCentralOversight` reads **only** `listLatestHospitalSnapshots` (the snapshot table + `Hospital` identity metadata) — it never queries patient/encounter/invoice/lab/pharmacy operational tables. It requires the **global** `central.aggregate.view` and audits `central.aggregate.accessed`.

## 4. Verification against doc 34 §7.14 (required tests)
| Requirement | Coverage |
|---|---|
| **Privacy: no patient-level data** in any central view/export | ✅ integration: a patient named `ZZZSECRETPATIENT` (+ phone, number) is created, a snapshot generated → the snapshot `indicators` JSON and the `getCentralOversight` payload contain **none** of name/number/phone; the indicators key-set is exactly the allowed aggregate set |
| Cross-hospital aggregate | ✅ central reads all hospitals' latest snapshots (aggregate-only) |
| Central role **cannot reach operational tables** | ✅ central read path uses only the snapshot table; generation (operational reads) is a separate hospital-side, `report.operational.read`-gated action; central supervisor (no that cap) **cannot generate** |
| RBAC | ✅ a hospital role without `central.aggregate.view` is **denied** the central view (+ `authz.denied` audit) |
| e2e central dashboard | ✅ `tests/e2e/supervision-centrale-3d.spec.ts` (admin generates; central views aggregates + "no patient data" notice; reception denied) |
| Audit | ✅ `central.snapshot.generated` + `central.aggregate.accessed` |

## 5. RBAC / audit summary
Reuses the 3B `central.aggregate.view` (global) + `superviseur_central` role. Generation gated by `report.operational.read` (admin/director, per-hospital). New audit `central.snapshot.generated`; `central.aggregate.accessed` recorded on every central read (hospitalId null — national scope). No central write capability exists.

## 6. UI
- `/central` — read-only aggregate dashboard (per-hospital cards: consultations/patients/revenue/queue/admissions/diagnostics/emergency-debt/pharmacy-alerts/top-ICD-diagnoses), with a prominent **"aggregate only — no patient data"** notice. Nav item `central` (gated `central.aggregate.view`). Bilingual `central` namespace (parity-guarded).
- A **"Générer l'instantané central"** action on `/rapports` (hospital admin/director) generates the hospital's snapshot.

## 7. Test evidence
[`docs/qa-command-output/3D/`](../qa-command-output/3D/). `tsc`/`eslint`/`check:arch`/`check:privacy`/`smoke` clean; `npm test` **331 passed**; `test:integration` **282 passed**; `test:e2e` **48 passed**. Vitest total **613** (331 + 282). Screenshots: [`docs/phase3d-screenshots/`](../phase3d-screenshots/).

### Adversarial review hardening (pre-commit)
The privacy-#1 review confirmed **1 MAJOR**, fixed here: the diagnosis **`label` is a free-text clinical field**, and it flowed verbatim into `topDiagnoses` → the snapshot → the `/central` page — so a clinician typing patient-identifying text into a diagnosis label would leak it to the national view (the central boundary must be *structurally* aggregate-only, not dependent on clinician discipline). **Fix:** snapshot generation now keeps **only valid ICD-10-coded** diagnoses and substitutes the **canonical reference label** (`DiagnosisCode.labelFr`) — never the clinician's free text — mirroring the existing DHIS2-export `validCodes` guard. Regression test added (a `B50` with a free-typed label carrying a patient name → the snapshot shows the canonical "Paludisme à Plasmodium falciparum"; a free-typed non-reference code is dropped; the patient text is absent). The reviewer's other candidate was refuted.

## 8. Known issues / notes
- The 3B `getCentralAggregates` (live per-hospital counts) remains as a simpler helper; the **3D dashboard uses the snapshot-fed `getCentralOversight`** to honour the "central never reads operational tables" rule. The `check:privacy` static scan plus the executable privacy integration test together satisfy §7.16.
- Snapshots are generated on demand (a button); a scheduled refresh is a deployment concern, not built here.

## 9. Boundary confirmation (doc 34 §2.1 + §7.17)
Synthetic / fake only · not Gate 7 · no real patient data · no production · **aggregate-only**, **no patient-level central access**, **no direct operational-DB queries by central**, **no BI/warehouse**, **no DHIS2 API** · hospital-scoped generation · RBAC server-side · audit on central access + snapshot generation · no `01_`/`02_` changes.

## 10. Files changed
- `prisma/schema.prisma` (+`HospitalAggregateSnapshot`), migration `20260630200000_phase3d_aggregate_snapshot`.
- `server/db/central-oversight.ts` (snapshot CRUD + `gatherSnapshotCounts` + `listLatestHospitalSnapshots`); `server/services/central-oversight-service.ts` (`generateHospitalAggregateSnapshot`, `getCentralOversight`, `SnapshotIndicators`).
- `server/services/audit-service.ts` (+`central.snapshot.generated`); db/services `index.ts` re-exports; `prisma/seed-data.ts` (reset cleanup).
- `server/actions/central-actions.ts`; `app/(app)/central/page.tsx`; `app/(app)/rapports/page.tsx` (generate button); `components/layout/nav.ts` (central nav item); `messages/fr.json`/`messages/en.json` (`central` ns + `nav.central`); `tests/unit/i18n-parity.test.ts`.
- `tests/integration/phase3d-central-oversight.test.ts`; `tests/e2e/supervision-centrale-3d.spec.ts`; `docs/qa-command-output/3D/`, `docs/phase3d-screenshots/`.
