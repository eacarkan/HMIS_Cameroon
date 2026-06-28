# Real-Data and Production Blockers (Gate 7)

**Project:** SIGH/DME (HMIS/EMR) — Phase 1 pilot-core foundation
**Status:** Draft for mentor review · **Date:** 2026-06-28 · **Data:** fake/demo only

> Real patient data and hospital operational use are **blocked until Gate 7** — an organizational gate that software completion alone cannot satisfy. The application being demonstrable on fake data is **not** production readiness and **not** real-data authorization. Every blocker below must be cleared, with most being MINSANTE/supplier responsibilities.

| # | Blocker | Why it blocks real use | Required evidence / authorization | Responsible party | Current status |
|---|---|---|---|---|---|
| 1 | No written MINSANTE real-data authorization | Real patient data may not be processed without it | Signed authorization defining scope/conditions | MINSANTE | Pending — à confirmer par le MINSANTE |
| 2 | No approved hosting environment / topology | No lawful, sovereign place to host real data | Approved hosting topology + data-sovereignty decision | MINSANTE + hosting supplier | Pending |
| 3 | No backup / restore procedure | Data loss risk; no recovery guarantee | Documented + tested backup/restore | Infrastructure supplier | Pending |
| 4 | No cybersecurity baseline & independent audit | Security posture unassessed | Baseline config + independent audit report | MINSANTE + independent auditor | Pending (execution is a supplier/specialist responsibility) |
| 5 | No privacy / data-protection validation | Personal health data must be protected by policy and design | Data-protection validation / DPIA-equivalent | MINSANTE (legal/privacy) | Pending |
| 6 | No access policy | Who may access what, and how access is granted/revoked | Approved access policy | MINSANTE | Pending — à confirmer par le MINSANTE |
| 7 | No account-lifecycle procedure | Account creation/approval/revocation must follow policy | Approved account-lifecycle procedure | MINSANTE | Pending (UI exists; procedure does not) |
| 8 | No training / UAT sign-off | Users unprepared; acceptance unproven | Training material + signed UAT | MINSANTE + hospitals | Pending — à confirmer lors de l'audit hospitalier |
| 9 | No acceptance protocol | No basis for formal acceptance | Agreed acceptance protocol + result | MINSANTE | Pending |
| 10 | No support / escalation process | No operational support guarantee | Defined support/escalation process | MINSANTE + provider | Pending |
| 11 | No hospital audit confirmations | Workflows/tariffs/forms not validated on site | Hospital audit findings | MINSANTE + hospitals | Pending — à confirmer lors de l'audit hospitalier |
| 12 | No real tariff validation | Billing must use validated official tariffs | Validated tariff catalogue + governance | MINSANTE + hospitals | Pending |
| 13 | No data retention / archiving policy | Legal retention/archival not defined | Approved retention/archiving policy | MINSANTE (legal) | Pending |
| 14 | No incident-response procedure | No defined response to security/data incidents | Approved incident-response procedure | MINSANTE + supplier | Pending |
| 15 | No supplier readiness (infra/security/telecom/firewall/backup) | Specialized works are outside the application | Supplier readiness confirmations | MINSANTE + suppliers | Pending |

## Statement
Gate 6 confirms readiness for **controlled demonstration and pilot-readiness review using fake/demo data only**. It is **not** ready for production use, **not** authorized for real patient data, and **not** authorized for hospital operational use. **Gate 7 authorization is required before any real data.**
