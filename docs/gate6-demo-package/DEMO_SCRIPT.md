# MINSANTE Controlled Demonstration — Role-Based Demo Script

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation
**Audience:** MINSANTE (controlled demonstration) · **Duration:** ≈60–90 minutes
**Data:** fake/demo only (HRB-DEMO) · **Status:** Draft for mentor review · **Date:** 2026-06-28

> Tone: restrained, administrative. Present facts, not marketing. Where something is not built or not authorized, say so plainly.

---

## Opening statement (read aloud, ≈2 minutes)
"This is a **controlled demonstration** of a **Phase 1 pilot-core foundation** for a Hospital Information System (SIGH) with an electronic medical record (DME), presented for technical review. Everything you will see runs on **fictional, seeded data** in a demonstration hospital. The system is a **functional demonstration prototype** — it is **not ready for production use**, it is **not authorized for real patient data**, and it is **not authorized for hospital operational use**. Its purpose today is to validate direction before hospital audit and detailed design, and to identify the decisions the Ministry needs to make next."

## Boundaries and disclaimers (read aloud, ≈2 minutes)
- The screen and every printed document carry the label: **« Prototype de démonstration fonctionnelle — non destiné à la production »**.
- All hospitals, users, patients, tariffs, and amounts are **fictional**. No live system is connected.
- Real-data use and operational use require a separate organizational authorization (**Gate 7**): written MINSANTE authorization, approved hosting, backup/restore, cybersecurity baseline and independent audit, data-protection validation, training, and an acceptance protocol.
- This demonstration **does not** constitute acceptance, production authorization, or a procurement award.
- Demonstration credentials are provided **separately through a controlled channel**; they are not shown here.

---

## Step-by-step demonstration flow

> Legend — **Role** = the demo account used · **Evidence** = the screenshot or check that corroborates the step.

### Segment 1 — Login, hospital context, role-aware navigation (≈5–10 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 1.1 | administrateur | Log in; show the home screen | "Access requires authentication. Note the prototype label, top right the active hospital, and that the menu reflects the role." | live; `docs/gate4-screenshots/01-administration-config.png` |
| 1.2 | administrateur | Show hospital selection | "All data is **scoped to the selected hospital**. Only the demonstration hospital HRB-DEMO is active; the others are listed but inactive." | live (`/selection-hopital`) |
| 1.3 | administrateur | Point out role-aware navigation | "The interface is **French-first**. The menu and actions change by role; access is enforced on the server, not merely hidden." | live |

### Segment 2 — Patient flow (≈10–15 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 2.1 | agent_accueil | Search for the patient first | "Registration begins with a **search-before-create** step to reduce duplicates." | live (`/patients`) |
| 2.2 | agent_accueil | Register patient *Aïssatou BELLO* | "Basic identity, fictional. The system assigns a per-hospital patient number, e.g. `HRB-DEMO-P-2026-000001`." | live; `03-patient-identite.png` |
| 2.3 | agent_accueil | Open the identity / contacts panel | "Contacts and identifiers can be recorded. A deterministic **duplicate notice** is shown for review — there is **no automatic merge and no national patient index** in this phase." | `03-patient-identite.png` |

### Segment 3 — Clinical flow (≈10–15 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 3.1 | agent_accueil | Open an outpatient encounter | "A visit is opened and linked to the patient and hospital, e.g. `HRB-DEMO-V-2026-000001` — motif « Fièvre et céphalées »." | live (`/patients/[id]/visite/nouvelle`) |
| 3.2 | medecin | Record a consultation | "The clinician records the consultation linked to that visit. The receptionist cannot do this — separation of duties." | live; `04-consultation-clinique.png` |
| 3.3 | medecin | Record structured observations and diagnosis | "Vitals/observations and a coded diagnosis sit beside free text. Prescription/order recording is **only if confirmed at audit** and is not demonstrated as a fulfilled workflow." | `04-consultation-clinique.png` |

### Segment 4 — Billing / receipt / cashier flow (≈10–15 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 4.1 | caissier | Create an invoice from DB tariffs | "Tariffs come from the **database** (no hard-coded prices). Two lines: consultation 2 000 + ouverture de dossier 1 000 = **3 000 FCFA**. The invoice freezes a price snapshot." | `05-facturation-tarifs.png` |
| 4.2 | caissier | Record the payment | "Payment in cash (espèces), integer FCFA, French formatting. The invoice becomes « Payée »." | live (`/encounters/[id]/facturation`) |
| 4.3 | caissier | Print the receipt | "A prototype receipt with an institutional-style (simulated) header — République / MINSANTE / hospital — **subject to MINSANTE validation**, the amount, a document number `HRB-DEMO-R-2026-000001`, and the prototype label. The official receipt format is a MINSANTE decision." | `06-recu.png` |
| 4.4 | caissier | Open the cashier daily report | "A per-day, per-hospital list of recorded payments with count and total — here 1 reçu / 3 000 FCFA." | `docs/gate5b-screenshots/01-rapport-caisse.png` |
| 4.5 | caissier | Export the report to CSV | "The report can be exported to CSV for review. The export is itself recorded in the audit log." | live (`/rapports-caisse/export`) |

### Segment 5 — Admin / configuration / user lifecycle (≈5–10 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 5.1 | administrateur | Show configuration (departments, units, tariffs) | "Master data — departments, service units, settings, tariffs — is configurable. Real tariffs require validation — **à confirmer lors de l'audit hospitalier**." | `01-administration-config.png`, `02-tarifs.png` |
| 5.2 | administrateur | Show user / account lifecycle | "Administrators can create accounts, activate/deactivate, and assign or remove roles, scoped to the hospital and audited." | `docs/gate5b-screenshots/02-utilisateurs.png` |
| 5.3 | administrateur | Note the admin-lockout safeguard | "The system prevents removing or deactivating the last administrator, and an administrator cannot lock themselves out. The full account-lifecycle **procedure** still requires MINSANTE approval." | live (refusal message) |

### Segment 6 — Audit / RBAC / security evidence (≈5–10 min)
| Step | Role | Action | Speaking note | Evidence |
|---|---|---|---|---|
| 6.1 | administrateur | Open the audit log | "Every meaningful action is recorded — who, what, when — in an append-only log with French labels." | `07-journal-audit.png` |
| 6.2 | agent_accueil | Attempt a cashier action (denied) | "A user without the capability is **blocked on the server**, and the denial is recorded as `authz.denied` — not merely hidden in the menu." | live; smoke check « RBAC block » |
| 6.3 | directeur | Show read-only oversight | "The director role is **read-only**: dashboards, patients, reports, audit — no create or modify." | live |

### Segment 7 — Known limitations (≈5 min)
Walk `DEMO_SCOPE_AND_LIMITATIONS.md` and the limitations list: no real data; no production/hosting; backup/restore, cybersecurity audit, training, legal EMR rules, data retention pending; Phase 2 modules (pharmacy, laboratory, radiology, inpatient, emergency, nursing, queue) and Phase 4 integrations (MPI, DHIS2, offline, insurance, external payments) not implemented; no mobile-readiness claim.

### Segment 8 — Decisions required from MINSANTE (≈5–10 min)
Walk `MINSANTE_DECISIONS_NEEDED.md`. Emphasize: written mandate to continue; confidentiality / reimbursement protection before deeper disclosure; authorization for the controlled demonstration; confirmation of target hospitals; hospital audit authorization; and the Gate 7 conditions for any real-data use.

---

## Closing — decisions needed from MINSANTE (read aloud, ≈2 minutes)
"To summarize: today demonstrates a **Phase 1 pilot-core foundation** on fake data — patient registration, encounter, consultation, billing and receipt, cashier reporting, configuration, user lifecycle, audit, and role-based access control. It is **not** production, and **not** authorized for real data. The Ministry's decisions we are requesting are: a **written mandate and confidentiality protection** before any deeper technical or financial disclosure; **authorization for a controlled demonstration**; **confirmation of the target hospitals and a hospital audit**; and the **conditions for Gate 7** — the organizational authorization required before any real patient data is used. Maintenance and operation, if later required, would be the subject of a **separate optional service contract**."
