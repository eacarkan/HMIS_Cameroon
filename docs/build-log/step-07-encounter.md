# Step 7 — Encounter (open a visit)

**Date:** 2026-06-27 · **Planning:** 05, 06 §14, 07 §6

## Implemented
- **Encounter data-access** (`server/db/encounters`): hospital-scoped create + find-by-id
  (with patient, assigned clinician, consultations, invoices).
- **Encounter service** (`encounter-service`): `openEncounter` authorizes
  (`encounter.create`), verifies the patient is in the hospital, mints
  `HRB-DEMO-V-2026-000001`, creates, audits `encounter.create`; `getEncounter`
  (`encounter.read`).
- **UI**: open-a-visit form within the patient context (`/patients/[id]/visite/nouvelle`
  — service select + motif, the patient banner on top); encounter view
  (`/encounters/[id]`) with the banner, info card (service, opened-at, clinician, motif),
  Consultations section (+ "Enregistrer la consultation") and Facturation section
  (+ "Créer la facture") — both gated by capability.
- Shared `fieldErrorsOf` zod helper in `lib/validation`.

## Verified
Service: reception opened `HRB-DEMO-V-2026-000001` (status open); audit chain now
includes `encounter.create` ("Ouverture de la visite HRB-DEMO-V-2026-000001").
build/lint/typecheck ✓. (Encounter view screenshot captured in the Step 13 rehearsal.)
