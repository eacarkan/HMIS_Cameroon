# Screenshot Index

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation · **Data:** fake/demo only (HRB-DEMO)
**Status:** Draft for mentor review · **Date:** 2026-06-28

> Existing screenshots are **referenced in place** (not duplicated). All were captured in production mode (no dev overlay) against the test database with deterministic fake data, and machine-validated (no 404; prototype label « Prototype de démonstration fonctionnelle — non destiné à la production » present). Each screen is shown with the role that uses it; **server-side RBAC is the real control — the UI only hides.**

## Gate 4 — French-first UI / workflows (`docs/gate4-screenshots/`)
| File | Workflow | Role | What it proves | Limitation |
|---|---|---|---|---|
| `01-administration-config.png` | Administration / configuration (departments, units, settings, document templates) | administrateur | Master-data configuration with activate/deactivate | Demo config; real structure à confirmer lors de l'audit hospitalier |
| `02-tarifs.png` | Tariff / price-list management | administrateur | DB-managed tariffs, integer FCFA | Demo tariffs; real tariff validation pending |
| `03-patient-identite.png` | Patient detail + identity/contacts panel | agent_accueil | Contacts, identifiers, duplicate **notice** (review-only) | No merge, **no MPI** |
| `04-consultation-clinique.png` | Consultation with structured observations + diagnosis | medecin | Vitals/observations + coded diagnosis beside free text | Minimal clinical scope; recording only |
| `05-facturation-tarifs.png` | Billing — cashier selects DB tariffs | caissier | DB-driven tariff selection; price snapshot frozen on invoice | Cash only; no refund/partial |
| `06-recu.png` | Prototype receipt (institutional-style header) | caissier | Institutional-style (simulated) République/MINSANTE/hospital header, FCFA amount, document number, prototype label | Not an official document; receipt/legal format subject to MINSANTE validation — à confirmer par le MINSANTE |
| `07-journal-audit.png` | Audit log (journal d'audit) | administrateur | Append-only who/what/when, French event labels | Sensitive-read audit policy pending |
| `README.md` | — | — | Capture method, validation, regeneration (`npm run screenshots:gate4`) | — |

## Gate 5B — cashier report + user lifecycle (`docs/gate5b-screenshots/`)
| File | Workflow | Role | What it proves | Limitation |
|---|---|---|---|---|
| `01-rapport-caisse.png` | Cashier daily report (rapport de caisse) | caissier | Per-day/per-hospital payments with count + total (1 reçu / 3 000 FCFA), CSV export action | Single-day; no accounting |
| `02-utilisateurs.png` | User / account lifecycle (utilisateurs) | administrateur | Create / activate-deactivate / assign-remove role, hospital-scoped; **no visible default password** | Temp demo password; account-lifecycle procedure pending |

## Notes on other screenshot sets (not part of this package's primary inventory)
The repository also contains earlier Phase-0 sets under `docs/screenshots/`, `docs/review-screenshots/`, and `docs/stakeholder-demo-screenshots/`. These predate the Phase 1 gates; for the MINSANTE demonstration use the **Gate 4** and **Gate 5B** sets above. Regenerate with `npm run screenshots:gate4` / `npm run screenshots:gate5b` (production mode, fake data) if a refresh is needed — not required for this package.
