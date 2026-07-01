# Gate 4 screenshots — UI / workflow

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Gate 4 French-first UI over the Gate 2 data model and Gate 3 services (RBAC + hospital
scoping + audit). Captured in **production mode** (no dev overlay) against the **test**
database with deterministic fake data (HRB-DEMO + Gate 4 demo enrichment). Each screen is
shown with the **role that uses it** (server-side RBAC is the real control; the UI only
hides what a role can't do). Machine-validated: no 404, prototype label present.

Regenerate: `npm run screenshots:gate4`.

| # | File | Screen | Actor |
|---|---|---|---|
| 1 | `01-administration-config.png` | Administration — Départements, Unités de service, Paramètres, Modèles de documents (create/deactivate) | Administrateur |
| 2 | `02-tarifs.png` | Tarifs / listes tarifaires — management (integer FCFA) | Administrateur |
| 3 | `03-patient-identite.png` | Patient detail + **Identité & contacts** panel (contacts, identifiers, duplicate notice — **no merge**) | Agent d'accueil |
| 4 | `04-consultation-clinique.png` | Consultation with structured **Constantes** + **Diagnostics** beside the kept free-text fields | Médecin |
| 5 | `05-facturation-tarifs.png` | Billing — cashier selects tariffs (sourced from the catalogue; snapshot frozen on the invoice) | Caissier |
| 6 | `06-recu.png` | Official receipt preserved (Payment + receiptNumber + Sequence; prototype label) | Caissier |
| 7 | `07-journal-audit.png` | Journal d'audit — new Gate 3/4 event labels visible (e.g. « Ajout contact patient ») | Administrateur |

Notes:
- **RBAC is role-aware:** the receptionist's and doctor's sidebars are filtered (admin
  config/tariffs hidden); only the cashier bills; only the doctor edits clinical structure.
- **No merge / MPI:** the duplicate panel is review-only (« aucune fusion »).
- **Snapshot preserved:** changing a tariff never alters historical invoices/receipts
  (proven by the Gate 3/4 integration tests).
- Fake data only; dev/test until Gate 7.
