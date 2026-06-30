# Phase 2I — Manual Laboratory & Radiology Workflows (text-only)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2i-lab-radiology` (stacked on 2G `f3a6679`)
**Boundaries:** manual entry only · synthetic-data UAT · not Gate 7 · no real data · **no analyzer integration · no HL7 · no external LIS · no PACS/DICOM · no image upload (radiology is text-only).**

## 1. Objective
A shared **manual** lab + radiology workflow: doctor requests → cashier confirms payment → technician enters a **text** result/report → validator validates → **PDF report**. **The requesting doctor cannot see the result until it is validated.**

## 2. Schema (additive — migration `…_phase2i_lab_radiology`)
- New enums **`DiagnosticModality`** (`lab`/`radiology`) + **`DiagnosticOrderStatus`** (`requested → payment_confirmed → in_progress → result_entered → validated` + `cancelled`).
- New model **`DiagnosticCatalogueItem`** (hospital-scoped orderable catalogue: code, nameFr/En, modality, integer `price`, isActive; admin-maintained).
- New model **`DiagnosticOrder`** (encounter, patient, catalogueItem; `orderNumber`; modality/itemLabel/price **snapshot**; status; isPaid/paidAt/paidById; `resultText`/resultEnteredBy/At; validatedBy/At; cancelReason; requestedBy). Append-and-transition.
- `SequenceType` += `diagnostic` (letter **E** = examen → `HRB-DEMO-E-2026-…`); additive back-relations on Hospital/Patient/Encounter. No drops.

## 3. Behaviour
- **Request** (`diagnostic.request`, doctor): on an **open** encounter; only an **active catalogue item in this hospital** can be ordered (server-side resolver); modality/label/price snapshot; audited.
- **Payment** (`diagnostic.payment.confirm`, cashier): `requested → payment_confirmed` (`isPaid`). Guarded.
- **Start + result** (`diagnostic.result.enter`, technician): `start` (→ in_progress) requires **paid OR emergency** (2H bypass — `canStartDiagnostic`; the start audit notes "URGENCE — paiement différé"); `enter` (→ result_entered) stores the manual text. Guarded.
- **Validate** (`diagnostic.validate`, validator): `result_entered → validated`. Guarded. **Enter ≠ validate** is the core clinical control.
- **Cancel** (`diagnostic.request`, doctor): any pre-validation state → cancelled (mandatory reason). A **validated order can never be cancelled** (guarded).
- **THE VISIBILITY GATE (`lib/diagnostics.isResultVisible`, enforced in the service):** every read that returns `resultText` (`getDiagnosticOrder`, `listDiagnosticsForEncounter`, `getDiagnosticWorklist`, `getDiagnosticReport`) **strips the result** unless the viewer is staff (holds enter/validate) OR the order is validated. The doctor sees the result only after validation. The report (`getDiagnosticReport`) is available **only for a validated order** (throws otherwise) and is audited `diagnostic.pdf_generated`.

## 4. RBAC + audit (capability-based; admin NOT a clinical superuser)
- New roles **`technicien_diagnostic`** (enters results) + **`validateur_diagnostic`** (validates) — the enter ≠ validate split. (A finer biologiste/radiologue split per modality is a documented future refinement; the data model already carries `modality`.) Two synthetic demo users seeded (Paul NGONO, Dr Marie EYENGA).
- New caps: `diagnostic.request` + `diagnostic.read` (medecin), `diagnostic.payment.confirm` (caissier), `diagnostic.result.enter` (technicien), `diagnostic.validate` (validateur), `diagnostic.catalogue.manage` (admin), `diagnostic.read` also for directeur + admin + both staff roles (oversight; result stays gated).
- Audit `diagnostic.catalogue_changed`/`requested`/`payment_confirmed`/`started`/`result_entered`/`validated`/`cancelled`/`pdf_generated` (+ French labels). **`resultText` is never written to the audit log.** Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/diagnostics.ts` (state machine, `isResultVisible`/`isResultVisibleToDoctor`, `canStartDiagnostic`, validators). `server/db/diagnostics.ts` (catalogue CRUD + guarded transitions). `server/services/diagnostic-service.ts` (the visibility enforcement + audit). `server/actions/diagnostic-actions.ts`.
- UI: a **Laboratoire & imagerie** card on the encounter page (request form + per-order capability-gated actions; the awaiting-validation notice replaces the result for the doctor); a `/laboratoire` worklist (modality filter); a printable report `/diagnostics/[id]/rapport` (official header, tracking number, validated result, validator name, stamp/signature space, synthetic marker); an admin catalogue page `/administration/examens`. Fr `diagnostic` namespace + a sparse `en.json` overlay (other strings fall back to French — progressive i18n).

## 6. Tests + results
- **Unit (`diagnostics`):** state machine (incl. emergency bypass), **the visibility rule** (doctor blind until validated; staff see in-progress/entered), payment/emergency start gate, validators.
- **`rbac`:** doctor requests; cashier pays; technician enters; validator validates; **enter ≠ validate**; admin catalogue-only; staff are not clinical/billing superusers.
- **Integration (`diagnostics-2i`):** full request→pay→start→enter→validate→report (price snapshot, audit); **the visibility gate (doctor blind at result_entered, staff can see, doctor sees after validation)**; payment gate (non-emergency blocked unpaid; emergency bypass with URGENCE audit); RBAC (cashier/doctor can't enter, technician can't validate); validated order can't be cancelled + report blocked pre-validation; ordering an inactive item refused.
- **Component (`diagnostics-2i`):** per-status action controls + the result shows only when present + the awaiting-validation notice + print link.
- **E2E (`laboratoire-2i`):** doctor requests → cashier pays → technician enters → **doctor cannot see the secret result** → validator validates → doctor sees it → prints the report. Sorts after the golden path.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · check:arch ✓ · check:privacy ✓. Full suite after 2I: vitest **496** (87 files), e2e **40**, 9 demo accounts.

## 7. Boundaries respected
Synthetic/fake data only · manual entry only · text-only (no analyzer/HL7/LIS/PACS/DICOM/image upload) · not Gate 7 · **doctor sees results only after validation (server-enforced)** · enter ≠ validate · payment gate with emergency-only bypass (2H) · catalogue admin-maintained · integer FCFA · hospital-scoped · capability RBAC · additive schema.

## 8. Adversarial review + result
A 6-agent review (4 dimensions led by the **result-visibility gate**, + rbac-scope, payment-state, integrity-audit, with a skeptical verify pass) found **NO confirmed blockers or majors**.
- **visibility-gate / rbac-scope / payment-state: clean.** No path lets the doctor (or any non-staff reader) obtain `resultText` before validation; enter ≠ validate and hospital scoping hold; the payment gate only bypasses for emergency encounters.
- **One "blocker" candidate (refuted).** A reviewer flagged the report's validator-name lookup (`findUserByIdWithRoles`) as a possible cross-hospital staff-directory leak. **Both verifiers ruled it not-a-bug:** the order is fetched hospital-scoped (`findDiagnosticOrderById(ctx.hospitalId, id)`), and `validatedById` is always the validating actor set within that hospital, so the name can't cross hospitals. No change.
- **One minor nit (accepted).** A concurrent `startDiagnostic` (emergency bypass) vs `confirmDiagnosticPayment` on the same order: tracing shows this is benign — if payment wins first the result is a valid pay→start sequence (both audits correct); if start wins first the confirm's guarded `updateMany` matches zero rows and throws **before** its audit is written. No double-audit-of-a-rejected-action; consistent with the codebase's append-only audit pattern. No fix.

## 9. Confirmation
This is Phase 2I. It reuses the 2A service-type model (LABORATORY/IMAGING exist), the 2H emergency bypass, and the existing billing/numbering. The only Phase 2 extension left is 2J (bilingual / UAT hardening). No analyzer/PACS; radiology is text-only.
