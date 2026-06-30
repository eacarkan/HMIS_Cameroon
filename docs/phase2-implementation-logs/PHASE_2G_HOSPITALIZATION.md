# Phase 2G — Simple Ward-Level Hospitalization (with daily ward fee)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2g-hospitalization` (stacked on 2H `54f24d4`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **no bed/room-level tracking** · no nursing care plans · no transfers · no inpatient EMR complexity.

## 1. Objective
A **restricted, ward-level** hospitalization workflow with mandatory billing linkage: **Admission Request (Doctor) → Ward Assignment (Admission Desk / Head Nurse) → Discharge Authorization (Doctor)**, a **configurable, deterministic, auditable daily ward fee**, and a discharge gate that blocks while invoices are unpaid or emergency debt (2H) is outstanding.

## 2. Schema (additive — migration `…_phase2g_hospitalization`)
- New enum **`AdmissionStatus`** (`requested`/`admitted`/`discharge_requested`/`discharged`/`cancelled`).
- New model **`Admission`** (encounter, patient, `admissionNumber`, status, reason, `wardServiceUnitId?`, snapshot `dailyWardFee` Int + `dailyFeeTariffId?`, `invoiceId?` @unique [the lazily-created hospitalization invoice], actor/timestamp columns per transition, `cancelReason?`). `@@unique[hospitalId, admissionNumber]`.
- New model **`AdmissionDailyCharge`** (admission, `chargeDate` @db.Date, `amount` Int, `invoiceItemId?`). **`@@unique[hospitalId, admissionId, chargeDate]`** = the per-day idempotency backstop (no double-bill).
- `SequenceType` += `admission` (letter **H** = hospitalisation); `Encounter`/`Patient`/`ServiceUnit`/`Invoice` gained additive back-relations only. No drops, no column changes to existing models.

## 3. Behaviour
- **Admission request** (`admission.request`, doctor): on an **open** encounter; one active admission per encounter (guarded); audited `admission.requested`. Number `HRB-DEMO-H-2026-…`.
- **Ward assignment** (`admission.assign`, admission desk / reception): `requested → admitted`, guarded `updateMany` so a concurrent second assignment loses. The ward must be an **active `INPATIENT_WARD`** service in this hospital (server-side resolver `findActiveInpatientWardServiceById` — UI hiding is not security). The **daily fee is resolved from the ward's active `Tariff` (code = ward code) and SNAPSHOT** onto the admission (deterministic + auditable); **assignment is refused if no active tariff is configured**. Audited `admission.ward_assigned`.
- **Daily ward fee** (`admission.fee.charge`, admission desk + cashier): one auditable charge per day. `accrueDailyChargeTx` is ONE `$transaction` that locks the admission row + asserts `admitted`, lazily creates the **single hospitalization invoice** on the first charge, appends a daily-fee `InvoiceItem`, bumps the invoice total, and records the `AdmissionDailyCharge`. **Idempotent**: the per-day unique + row lock collapse a same-day re-charge (returns `created:false`, no double-bill). Audited `admission.daily_fee_charged` (only when a charge is actually created).
- **Discharge** (`admission.discharge`, doctor): `requestDischarge` (`admitted → discharge_requested`) then `authorizeDischarge` (`→ discharged`). **The discharge gate** (`computeDischargeBlock`, pure): BLOCKED while the encounter has **unpaid invoices** (status ∉ paid/cancelled) OR **outstanding emergency debt** (2H `countOutstandingEmergencyDebt`). The error names the reasons. Guarded transition. Audited `admission.discharge_requested` / `admission.discharged`.
- **Cancel** (`admission.request`, doctor): `requested → cancelled` only (before a ward is assigned), mandatory reason, audited `admission.cancelled`.

## 4. RBAC + audit (capability-based; admin is NOT a clinical/billing superuser)
- New capabilities: **`admission.request`** + **`admission.discharge`** (medecin), **`admission.assign`** + **`admission.fee.charge`** (agent_accueil — admission desk / head nurse), **`admission.fee.charge`** also (caissier — billing act), **`admission.read`** (medecin + agent_accueil + caissier + directeur + administrateur). The administrator gets **read-only** oversight (cannot request/assign/discharge/charge).
- Audit actions `admission.requested`/`ward_assigned`/`cancelled`/`discharge_requested`/`discharged`/`daily_fee_charged` (+ French `AUDIT_ACTION_LABELS`). Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/hospitalization.ts` (state machine `canTransitionAdmission`, `validateAdmissionRequest`, `validateDailyWardFee`, `computeDischargeBlock`, `dailyChargeDate(Key)` UTC idempotency key) + `lib/service-catalogue.isInpatientWardService`. `server/db/hospitalization.ts` (CRUD + guarded transition `updateMany`s + the idempotent `accrueDailyChargeTx`) + `db/config` ward resolvers + `db/invoices.listOpenInvoicesForEncounter`. `server/services/hospitalization-service.ts`. `server/actions/hospitalization-actions.ts`.
- UI: a **Hospitalisation** card on the encounter page (`components/hospitalization/admission-controls.tsx`) — request → ward picker (+ fee) → daily-fee button → request/authorise discharge with the live block reasons, all capability-gated; the **Authorise** button is disabled while the gate is blocked. A `/hospitalisations` board lists admissions. Fr `admission` namespace + a sparse `en.json` overlay (other strings fall back to French — progressive i18n).

## 6. Tests + results
- **Unit (`hospitalization`):** state machine (legal/illegal transitions, terminal/active), reason + daily-fee validation, the discharge gate (unpaid / emergency / combined reasons), the UTC per-day idempotency key. **`rbac`:** doctor requests/discharges; admission desk assigns + charges; cashier charges; reads broad; admin read-only.
- **Integration (`hospitalization-2g`):** full request→assign(snapshot fee)→daily-fee→**discharge blocked while unpaid**→pay→discharge; **idempotent per-day + per-distinct-day**; **concurrent same-day charges never double-bill**; ward must be `INPATIENT_WARD` (outpatient rejected); **assignment refused with no configured tariff**; RBAC (doctor can't assign, reception can't discharge/request); cancel-before-admit then assign refused; **concurrent double-assign loses**; one active admission per encounter; **discharge blocked by outstanding emergency debt (2H) and clears once settled**; `getAdmissionForEncounter` surfaces the live gate.
- **Component (`hospitalization-2g`):** request form / ward picker / admitted view (fee, invoice link, charge + discharge controls) / blocked discharge disables Authorize + shows reasons / capability gating.
- **E2E (`hospitalisation-2g`):** doctor requests → desk assigns ward → daily fee → discharge blocked → cashier pays → doctor discharges; board lists it. Sorts after the golden path.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **ward-level only (no bed/room map, no bed lifecycle)** · no nursing care plans / transfers / inpatient EMR · daily fee is deterministic (tariff snapshot) + auditable · discharge gate enforces billing + emergency-debt settlement · integer FCFA · hospital-scoped · capability RBAC (admin not clinical/billing) · additive schema.

## 8. Adversarial review + hardening
A 9-agent review (4 dimensions: billing-integrity, discharge-gate, rbac-scope, state-concurrency + a skeptical verify pass) confirmed **2 blockers + 3 majors**. The rbac-scope dimension found nothing (server-side ward resolution + scoping held). All confirmed defects were fixed BEFORE commit:

- **BLOCKER — concurrent `requestAdmission` could double-admit one encounter.** The active-admission check and the create were not atomic (no DB constraint, no lock). **Fix:** `createAdmissionTx` (`server/db/hospitalization.ts`) now runs in a `$transaction` that **locks the encounter row first**, re-checks for a non-terminal admission under that lock, then creates — so two concurrent requests serialise and the second is rejected. Regression test added (concurrent requests → exactly one admission).
- **BLOCKER/MAJOR — discharge-gate TOCTOU.** The gate (unpaid invoices + outstanding emergency debt) was checked OUTSIDE the transition, so a concurrent emergency-debt accrual could slip through (discharge with debt) and a just-completed payment could falsely block. **Fix:** the gate now lives INSIDE `authorizeDischargeTx` — one `$transaction` that **locks the encounter row** (the same row `accrueEmergencyDebtTx` locks, so they serialise), re-reads the gate under the lock, and transitions only if clear. The existing "blocked by emergency debt after the invoice is paid" test now exercises this in-tx path.
- **MAJOR — concurrent first daily charge could orphan an invoice.** `accrueDailyChargeTx` read `admission.invoiceId` from a PRE-lock snapshot, so a second concurrent first-charge created a second invoice and overwrote the link (orphan). **Fix:** the lock-and-read is now a single `tx.admission.update` whose returned row gives the **post-lock** `invoiceId`; the second accrual sees the first's invoice and appends to it. Regression test added (concurrent distinct-day charges → exactly one invoice, both items, no orphan).
- **NIT applied:** daily-fee `InvoiceItem`s now carry `tariffId` (Admission → Tariff → InvoiceItem audit chain).

**Accepted, not changed (documented):**
- **Audit-after-commit** (`recordAudit` runs after the data write, not in the same transaction) — this is the **consistent codebase-wide pattern** across 2C/2D-5/2D-6, mentor-accepted in 2D-6, not a 2G regression. Revisiting it is a cross-cutting change for a later pass, out of scope here.
- **Wasted invoice numbers** (minor) — a rare concurrent-first-charge race can burn one invoice-sequence number (a gap); sequences are not required gapless. No data effect after the orphan fix.

## 9. Confirmation
This is Phase 2G. It consumes 2H's `countOutstandingEmergencyDebt` as part of the discharge gate and reuses the 2A service catalogue (INPATIENT_WARD) + the existing Tariff/Invoice billing. No bed-level tracking; no clinical decision support.
