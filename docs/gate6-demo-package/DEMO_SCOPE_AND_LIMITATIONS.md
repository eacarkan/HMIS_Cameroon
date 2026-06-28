# Demo Scope and Limitations

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation · **Data:** fake/demo only (HRB-DEMO)
**Status:** Draft for mentor review · **Date:** 2026-06-28

> "Demonstrated" = implemented and shown on fake/demo data. It does **not** imply production readiness or authorization for real patient data. All real-data use requires **Gate 7**.

## Demonstrated capabilities
| Demonstrated capability | Evidence path | Status | Limitation | Decision required |
|---|---|---|---|---|
| Login (server-side credentials, sign-out audited) | `command-output.txt` (smoke); live | Demonstrated (fake data) | No MFA/SSO; demo passwords via controlled channel | Access policy & auth strength — à confirmer par le MINSANTE |
| Hospital selection + hospital scoping | smoke « hospital scoping (cross-hospital denied) » | Demonstrated | Only HRB-DEMO active; 7 hospitals inactive | Confirm target hospitals — à confirmer par le MINSANTE |
| Role-aware navigation (RBAC, server-enforced) | smoke « RBAC block »; `07-journal-audit.png` | Demonstrated | Coarse Phase 1 roles | Roles & approval workflow — à confirmer par le MINSANTE |
| Patient search-before-create | `03-patient-identite.png`; E2E | Demonstrated | Deterministic duplicate **notice** only | Duplicate/MPI policy — à confirmer lors de l'audit hospitalier |
| Patient registration (per-hospital number) | `03-patient-identite.png`; smoke patient `HRB-DEMO-P-2026-000001` | Demonstrated | Basic identity, fake data | Identity fields & validation — à confirmer lors de l'audit hospitalier |
| Patient identity / contact / identifier / duplicate panel | `03-patient-identite.png` | Demonstrated | No merge, **no MPI** | National MPI — deferred (Phase 4) |
| Outpatient encounter (open/close) | smoke encounter `HRB-DEMO-V-2026-000001`; E2E | Demonstrated | Outpatient only | Inpatient/emergency — deferred (Phase 2) |
| Consultation (clinician) | `04-consultation-clinique.png`; integration | Demonstrated | Minimal clinical scope | Clinical workflow — à confirmer lors de l'audit hospitalier |
| Structured observations / diagnosis | `04-consultation-clinique.png` | Demonstrated | Recording only | Coding standards — à confirmer lors de l'audit hospitalier |
| DB-driven tariff selection (snapshot on invoice) | `05-facturation-tarifs.png`; integration | Demonstrated | Demo tariffs only | Real tariff validation & governance — à confirmer par le MINSANTE |
| Invoice / payment / receipt (integer FCFA) | `06-recu.png`; smoke total `3 000 FCFA` / receipt `HRB-DEMO-R-2026-000001` | Demonstrated | Cash only; no refund/partial | Receipt/legal format — à confirmer par le MINSANTE |
| Cashier daily report | `01-rapport-caisse.png`; integration | Demonstrated | Single-day; no accounting | Cashier reporting needs — à confirmer lors de l'audit hospitalier |
| CSV export (audited) | live `/rapports-caisse/export`; integration | Demonstrated | Flat list + total | Export format/governance — à confirmer par le MINSANTE |
| Dashboard (real-action tile values) | smoke « dashboard KPIs (1 / 1 / 3 000 FCFA) » | Demonstrated | One operational tile | KPI catalogue — à confirmer lors de l'audit hospitalier |
| Audit log (append-only who/what/when) | `07-journal-audit.png`; smoke « audit chain 15 entries » | Demonstrated | No sensitive-read policy yet | Sensitive-read audit policy — à confirmer par le MINSANTE |
| RBAC (deny-by-default, server-side) | smoke « RBAC block »; integration | Demonstrated | Coarse roles | Roles & separation of duties — à confirmer par le MINSANTE |
| Hospital scoping (cross-hospital denied) | smoke; integration | Demonstrated | — | — |
| User / account lifecycle (admin-only, audited, lockout-safe) | `02-utilisateurs.png`; integration (55) | Demonstrated | Temp demo password; no email invite/reset | Account-lifecycle procedure — à confirmer par le MINSANTE |

## Not demonstrated / not claimed (intentional Phase-1 boundaries)
| Item | Status | Decision / next gate |
|---|---|---|
| Real patient data | Not used (never) | Gate 7 — real-data authorization |
| Production deployment / approved hosting | Not done | Gate 7 — hosting topology decision |
| Backup/restore, cybersecurity baseline & audit | Not done | Gate 7 — supplier/independent audit |
| Legal EMR / signature / archival, data retention | Pending | à confirmer par le MINSANTE |
| Training / UAT sign-off, acceptance protocol | Pending | à confirmer par le MINSANTE |
| Hospital workflow audit, real tariff validation, receipt format | Pending | à confirmer lors de l'audit hospitalier |
| Phase 2 modules: queue/appointments, emergency, hospitalization/inpatient, nursing, pharmacy, laboratory, radiology, medical documents, stock | Not implemented | Phase 2 (post-audit) |
| Phase 4 integrations: MPI, DHIS2, offline mode, insurance/mutuelle, external payments, SMS/email, advanced BI | Not implemented | Phase 4 (deferred) |
| Mobile application / mobile-readiness | Not claimed | Deferred |
