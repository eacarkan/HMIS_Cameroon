# Role-Based Demo Users (Redacted)

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation · **Data:** fake/demo only (HRB-DEMO)
**Status:** Draft for mentor review · **Date:** 2026-06-28

> ⚠️ **No passwords appear in this document or anywhere in the repository.** Demonstration credentials are distributed **separately through a controlled channel**. All names, e-mails, and the hospital below are **fictional** seeded demo data.

## Active demonstration hospital
- **Name:** Hôpital Régional de Bertoua — Démo
- **Code:** HRB-DEMO (fictional)
- (Seven additional hospitals are listed but inactive in the demo dataset.)

## Demo role accounts (HRB-DEMO)
| Role (code) | Role (FR) | Demo display name | Demo e-mail (fictional) | Demonstrates |
|---|---|---|---|---|
| `administrateur` | Administrateur | Awa NJOYA | awa.njoya@hrb-demo.cm | Configuration, tariffs, user/account lifecycle, audit, dashboards |
| `agent_accueil` | Agent d'accueil | Brigitte MBARGA | brigitte.mbarga@hrb-demo.cm | Patient search/registration, open/close encounter |
| `medecin` | Médecin | Dr Jean-Paul ETOA | jeanpaul.etoa@hrb-demo.cm | Consultation, observations, diagnosis |
| `caissier` | Caissier | Solange ABENA | solange.abena@hrb-demo.cm | Tariff use, invoice, payment, receipt, cashier report/export |
| `directeur` | Directeur (lecture seule) | Dr Emmanuel TCHOUA | emmanuel.tchoua@hrb-demo.cm | Read-only oversight: dashboards, patients, reports, audit |

## Notes
- The `@hrb-demo.cm` domain is **fictional** and not a real mail domain.
- The split of `administrateur` into système / hospitalier is **à confirmer par le MINSANTE**; the demo uses a single administrator role.
- The director account is **read-only** by design (no create/modify).
- Credentials, credential rotation, and account approvals follow an account-lifecycle **procedure** that is **pending MINSANTE approval** (à confirmer par le MINSANTE).
