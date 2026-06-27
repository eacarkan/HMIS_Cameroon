# Build log

One file per build step (`09 §14`), recording what was implemented, the key
decisions, and how it was verified. ADRs (`docs/adr/`) hold the durable decisions;
these logs are the running implementation diary.

| Step | Log | Status |
|---|---|---|
| 1–2 | [Foundations](step-01-02-foundations.md) | ✅ |
| 3 | [Fake demo data](step-03-fake-data.md) | ✅ |
| 4 | [Auth shell](step-04-auth-shell.md) | ✅ |
| 5 | [Hospital scoping + RBAC](step-05-hospital-scoping-rbac.md) | ✅ |
| 6 | [Patient search/create + banner](step-06-patient.md) | ✅ |
| 7 | [Encounter](step-07-encounter.md) | ✅ |
| 8 | [Consultation](step-08-consultation.md) | ✅ |
| 9 | [Billing / payment](step-09-billing-payment.md) | ✅ |
| 10 | [Receipt print](step-10-receipt.md) | ✅ |
| 11 | [Dashboard KPIs](step-11-dashboard.md) | ✅ |
| 12 | [Audit log view](step-12-audit-log.md) | ✅ |
| 13 | [Demo rehearsal](step-13-demo-rehearsal.md) | ✅ |
| 14 | [Testing & QA](../implementation-notes/STEP_14_TESTING_AND_QA.md) | ✅ |

**The first walking skeleton (Steps 1–13) is complete**, with a full **testing & QA
layer (Step 14)** on top — unit, integration, component, E2E, smoke, plus architecture
and privacy guardrails. Run `npm run smoke` for the golden-path verification,
`npm run test:all` for the full suite, or follow [DEMO.md](../DEMO.md) for the live demo;
manual UAT in [docs/testing/](../testing/UAT_PHASE_0_WALKING_SKELETON.md).
