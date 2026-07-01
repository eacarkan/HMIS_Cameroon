# Phase 2D-1 — Medication Catalogue

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2d-1-medication-catalogue` (stacked on 2C `5b41c6d`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · no stock/quantities here (2D-3) · no prescriptions (2D-2) · no external integration.

## 1. Objective
Add a hospital-scoped **medication catalogue** (bilingual names, galenic form, dispensing unit, optional strength, active flag, display order) — the foundation the rest of Phase 2D builds on. Admin-managed; clinicians + pharmacy read it.

## 2. Schema (additive — migration `…_phase2d1_medication_catalogue`)
- **`Medication`** — `hospitalId`, `code`, `nameFr`, `nameEn`, `form`, `unit`, `strength?`, `isActive`, `displayOrder`, soft-delete + audit cols. `@@unique([hospitalId, code])`. No quantities/prices (those live on the stock ledger / prescriptions in later sub-batches).
- Hospital `+ medications`. No drops/renames.

## 3. Pharmacy roles (foundation for 2D)
Added two roles needed across the pharmacy module (dual validation): **`pharmacien`** (pharmacist — will dispense + enter stock + request adjustments) and **`pharmacien_chef`** (Pharmacist-in-Charge — will authorise FEFO overrides + approve adjustments). Seeded as two synthetic demo users (Georges MBALLA, Claire FOTSO). For 2D-1 they have baseline operational reads + `medication.view`; the pharmacy-specific capabilities arrive in 2D-5…2D-7.

## 4. RBAC + audit
- Capabilities: **`medication.manage`** (administrateur only — the catalogue is configuration) + **`medication.view`** (administrateur, medecin, pharmacien, pharmacien_chef, directeur). Reception is not in the medication flow.
- Audit: `medication.created / updated / deactivated / reactivated` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- `lib/medication.ts` (pure: `validateMedicationInput`, `normalizeMedicationDisplayOrder`, `MEDICATION_FORMS`); `server/db/medications.ts`; `medication-service.ts` (list/create/update/deactivate/reactivate, capability + audit); `medication-actions.ts`.
- UI: `/administration/medicaments` (admin CRUD: create form + active/inactive table with deactivate/reactivate) + a "Médicaments" link on the administration hub. Fr/En labels. Synthetic seed: 6 illustrative medications (Paracétamol, Amoxicilline, Métronidazole, ACT, Ibuprofène, SRO).

## 6. Tests + results
- **Unit:** `medication` (validation, display-order, forms); `rbac` (+2D-1 medication caps, pharmacy roles de-scoped from clinical/billing).
- **Integration (`medication-2d1`):** seeded catalogue; admin create (audited) + duplicate-code rejection; update/deactivate/reactivate; invalid-input rejection; RBAC (doctor + pharmacist view but cannot manage; reception cannot view); hospital scoping.
- **Component:** the catalogue create form (fields + galenic-form options).
- **E2E:** admin adds a medication + sees the seeded catalogue; reception is redirected (RBAC).
- Updated the seed-count assertions (5→7 users/roles) in auth / gate3 / phase1-data-model / smoke.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component **163** · integration **137** · build ✓ · e2e **24** · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓ (7 demo accounts, all @hrb-demo.cm). Mirrors the adversarially-reviewed 2A service-catalogue pattern.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · catalogue only (no stock/quantities/prices) · admin-managed · hospital-scoped · bilingual keys · additive schema. **"Go-live" = controlled synthetic-data UAT.**

## 8. Confirmation
This is Phase 2D-1 only — no prescription (2D-2), stock (2D-3), reservation/dispensing/FEFO/adjustments (2D-4…7), or reporting (2D-8). Pharmacy roles were added as foundation but carry no dispensing/stock capabilities yet.
