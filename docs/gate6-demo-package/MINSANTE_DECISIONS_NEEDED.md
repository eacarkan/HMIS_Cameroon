# MINSANTE — Decisions Needed

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation
**Status:** Draft for mentor review · **Date:** 2026-06-28 · **Data:** fake/demo only

> These decisions are required from the Ministry of Public Health (MINSANTE) to move beyond a controlled demonstration toward a pilot. Items marked **à confirmer par le MINSANTE** are awaiting Ministry confirmation; clinical/operational items are also **à confirmer lors de l'audit hospitalier**.

| # | Decision required | Why needed | Owner | Required timing | Risk if not decided |
|---|---|---|---|---|---|
| 1 | Written mandate / authorization to continue | Basis to invest further and to engage the Ministry formally | MINSANTE | Before further work | Effort without mandate; unclear direction — à confirmer par le MINSANTE |
| 2 | Confidentiality / exclusivity / reimbursement protection **before full disclosure** | Protects IP, financial model, and supplier strategy before deeper sharing | MINSANTE + provider | Before any full proposal | Uncompensated disclosure of know-how — à confirmer par le MINSANTE |
| 3 | Authorization for the controlled demonstration | Formal cover to present to stakeholders on fake data | MINSANTE | Before the demo | Demo held without authorization — à confirmer par le MINSANTE |
| 4 | Confirmation of target hospitals | Defines pilot scope and audit targets | MINSANTE | Before hospital audit | Scope ambiguity; wrong assumptions — à confirmer par le MINSANTE |
| 5 | Hospital audit authorization | Real workflows, tariffs, and forms must be validated on site | MINSANTE + hospitals | Before pilot design | Design built on assumptions — à confirmer lors de l'audit hospitalier |
| 6 | Real-data authorization conditions (Gate 7 scope) | Real patient data cannot be used without organizational authorization | MINSANTE | Before any real data | Illegal/unsafe real-data use — à confirmer par le MINSANTE |
| 7 | Hosting / data-sovereignty decision | Where and how data is hosted (national sovereignty) | MINSANTE | Before pilot launch planning | No lawful hosting basis — à confirmer par le MINSANTE |
| 8 | Cybersecurity audit process | Independent baseline + audit required before real use | MINSANTE + auditor | Before Gate 7 | Unassessed security risk — à confirmer par le MINSANTE |
| 9 | Tariff governance | Who validates and maintains official tariffs | MINSANTE + hospitals | Before billing on real data | Incorrect billing — à confirmer lors de l'audit hospitalier |
| 10 | Receipt / legal-document format | The receipt and document layout must be validated before any official use | MINSANTE | Before pilot use | Non-compliant documents — à confirmer par le MINSANTE |
| 11 | User roles and approval workflow | Confirm role model (e.g. single vs split admin) and account approvals | MINSANTE | Before pilot onboarding | Misaligned access control — à confirmer par le MINSANTE |
| 12 | Legal EMR / signature / archive rules | Legal validity of electronic records and signatures | MINSANTE (legal) | Before real EMR use | Records without legal standing — à confirmer par le MINSANTE |
| 13 | Sensitive-read audit policy | Define which read accesses must be logged | MINSANTE | Before real data | Privacy gaps — à confirmer par le MINSANTE |
| 14 | Training / UAT protocol | How users are trained and acceptance is tested | MINSANTE + hospitals | Before pilot launch | Unprepared users; failed UAT — à confirmer lors de l'audit hospitalier |
| 15 | Acceptance protocol | Criteria for formal acceptance | MINSANTE | Before acceptance | No acceptance basis — à confirmer par le MINSANTE |

## Note
None of the above is satisfied by software alone. Items 6–8 and 14–15 are central to **Gate 7** (the organizational gate that authorizes real-data and operational use). Maintenance / operation (O&M), if later required, would be the subject of a **separate optional service contract**, not part of the implementation package.
