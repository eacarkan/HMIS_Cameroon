# Step 6 — Patient search/create + banner

**Date:** 2026-06-27 · **Planning:** 06 §6/§7/§9/§10, 05 §6, 07

## Implemented
- **Transaction-safe numbering** (`server/db/sequence.nextSequenceValue` — atomic
  `increment`) + `numbering-service.generateNumber` → `HRB-DEMO-P-2026-000001`.
- **Patient data-access** (`server/db/patients`): hospital-scoped create / search (name
  or number, soft-delete aware) / find-by-id (with encounters → invoices → payments).
- **Patient service** (`patient-service`): each use-case authorizes (`patient.read` /
  `patient.create`), scopes by hospital, mints the number, and audits `patient.create`.
- **UI**: search-before-create list (`/patients`, GET search box + results table +
  "Créer un patient" gated by capability); sectioned create form (`/patients/nouveau`,
  Informations principales / complémentaires, inline French validation via
  `createPatientAction`); patient detail (`/patients/[id]`) with the mandatory sticky
  **patient banner** (06 §6) + Dossier / Visites / Factures sections + "Ouvrir une visite".
- `requireActorAndHospital()` helper (redirects when session/hospital missing).
  `lib/dates.ageInYears`.

## Verified
Service: created Aïssatou BELLO → `HRB-DEMO-P-2026-000001`; scoped search returns her;
audit chain auth.login → hospital.select → patient.create ("Création du patient
Aïssatou BELLO"). build/lint/typecheck ✓. Screenshots 07 (list), 08 (form), 09 (detail
+ banner). RBAC: reception can create; the create CTA hides for roles without
`patient.create`.
