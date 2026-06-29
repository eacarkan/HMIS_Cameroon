# Phase 2D-2 — Structured Prescription + Printable PDF

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-2-prescription` (stacked on 2D-1 `b292d5d`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **NO stock effect** (reservation = 2D-4, dispensing = 2D-5) · e-signature deferred · no external integration.

## 1. Objective
Add a structured **prescription** (ordonnance) a doctor writes during an encounter, linked to the medication catalogue, with a lifecycle and a **printable PDF** — and **no stock effect** yet.

## 2. Schema (additive — migration `…_phase2d2_prescription`)
- **`PrescriptionStatus`** enum `draft / finalized / sent_to_pharmacy / partially_dispensed / dispensed / cancelled` (dispensing transitions are driven by 2D-5).
- **`SequenceType` += `prescription`** (letter `O` — ordonnance).
- **`Prescription`** — prescriptionNumber, patientId, encounterId, prescribedById, status, notes?, finalizedAt/sentAt/cancelledAt. `@@unique([hospitalId, prescriptionNumber])`.
- **`PrescriptionItem`** — medicationId (source) + **`medicationLabel`/`unit` SNAPSHOT** at prescribe time (the printed ordonnance is stable even if the catalogue changes), dosage, frequency?, duration, **integer quantity**, instructions?. `onDelete: Cascade` from the prescription.
- Relations on Hospital / Patient / Encounter / User / Medication. No drops/renames.

## 3. Behaviour
- **Create (doctor, `prescription.create`):** validates each line (`lib/prescription.validatePrescriptionItem` — medication + dosage + duration + positive integer quantity), checks the medication is active in the hospital, snapshots its label/unit, numbers the ordonnance, status `draft`. Audit `prescription.created`.
- **Lifecycle (`lib/prescription` state machine):** `draft → finalized → sent_to_pharmacy` (+ `cancelled` from any non-terminal). Illegal jumps (e.g. draft → sent, re-finalizing a sent one) are rejected. Audits `prescription.finalized / sent_to_pharmacy / cancelled`. **No stock effect** anywhere in 2D-2.
- **Printable PDF** (`react-to-print`, A4): hospital header, document tracking number, printed doctor name, prescribed lines (dosage/frequency/duration/quantity), instructions, **doctor stamp/signature space**, synthetic-data marker. e-signature deferred.

## 4. RBAC + audit
- Capabilities: **`prescription.create`** (medecin only — a clinical act) + **`prescription.read`** (medecin, pharmacien, pharmacien_chef [to dispense in 2D-5], administrateur, directeur). Reception/cashier are not in the flow.
- Audit: `prescription.created / finalized / sent_to_pharmacy / cancelled` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- `lib/prescription.ts` (state machine + line validation); `server/db/prescriptions.ts`; `prescription-service.ts` (create + finalize/send/cancel, capability + audit); `prescription-actions.ts` (editor submits a variable-length item list as JSON).
- UI: doctor's **prescription editor** (`/encounters/[id]/ordonnance/nouvelle`, add/remove lines, medication picker from the active catalogue); the **printable ordonnance** + lifecycle controls (`/ordonnances/[id]`); a **prescriptions card** on the encounter page (list + "Nouvelle ordonnance" link). Fr/En labels (`prescription` + `prescriptionStatus`).

## 6. Tests + results
- **Unit:** `prescription` (state machine: legal/illegal transitions, terminal; line validation); `rbac` (+2D-2 caps).
- **Integration (`prescription-2d2`):** create (numbered `…-O-…`, snapshot label/unit, audited); lifecycle finalize→send (audited) + invalid-transition rejection; cancel from draft; invalid line + unknown-medication rejection; RBAC (reception can't prescribe; pharmacist reads but can't prescribe); encounter listing (scoped).
- **Component:** the editor (item row + medication options + add/create) and the print document (tracking number + line + doctor signature space + synthetic marker).
- **E2E:** reception opens a visit → doctor prescribes → finalize → send to pharmacy → printable ordonnance.
- Seed `clearOperationalData` now deletes prescriptions before encounters/medications (FK).

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **174** · integration **144** · build ✓ · e2e **25** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · **prescription has NO stock effect** (reserve = 2D-4, dispense/deduct = 2D-5) · doctor-only creation · snapshot lines · e-signature deferred · additive schema · hospital-scoped · bilingual keys.

## 8. Confirmation
This is Phase 2D-2 only — no stock ledger (2D-3), reservation (2D-4), dispensing/deduction (2D-5), FEFO (2D-6), adjustments (2D-7) or pharmacy reporting (2D-8). The prescription never touches stock.
