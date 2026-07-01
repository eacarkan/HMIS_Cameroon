# Gate 5 — Test / UAT evidence package

> **« Prototype de démonstration fonctionnelle — non destiné à la production »**

Consolidated evidence that the **Phase 1 pilot-core** workflows work under **fake/demo
data** (HRB-DEMO). Branch `feature/gate4-ui-workflows`; baseline commits `9132868` (Gate 2)
→ `716762c` (Gate 3) → `996852a` (Gate 4) → `aeb2ac9` (Gate 4 QA). **No new features** were
added in Gate 5 — this is evidence consolidation only.

Companion report: `03_Software/Planning/27_Gate_5_Test_UAT_Evidence_Consolidation_Report.md`.

## Contents
- `UAT_CHECKLIST.md` — 24 role-based UAT scenarios with evidence + result.
- `command-output.txt` — redacted output of the full verification suite (all exit 0).
- This `README.md` — role matrix + screenshot index + limitations.

## How to reproduce (fake data, test DB)
`npm run typecheck && npm run lint && npm run build && npm run test && npm run test:integration && npm run test:e2e && npm run smoke:test && npm run check:arch && npm run check:privacy && npm run screenshots:gate4`

## Verification summary (this run — all green)
| Check | Result |
|---|---|
| typecheck · lint · build | ✅ |
| unit + component tests | ✅ **41 passed** (12 files) |
| integration tests (test DB) | ✅ **45 passed** (12 files) |
| E2E (Playwright) | ✅ **8 passed** (golden path + RBAC + logout) |
| smoke / golden-path | ✅ GOLDEN PATH PASSED (13 checks) |
| architecture guardrail | ✅ no Prisma in UI |
| privacy / fake-data | ✅ no secrets; prototype label; fake accounts |
| Gate 4 screenshots | ✅ 7 captured + validated (no 404) |

## Role evidence matrix
| Role | Allowed (verified) | Denied (verified, `authz.denied`) | Evidence |
|---|---|---|---|
| Administrateur | config (dept/unit/setting/template), tariffs/price-lists, audit read, dashboard | patient-identity manage, clinical structure, tariff.use (billing) | integration `gate3-rbac-audit`; screenshots `01`,`02`,`07` |
| Agent d'accueil | patient search/create, encounter open, contacts/identifiers, duplicate review | config, tariffs, consultation/diagnosis, payment | integration `gate3` + `gate4-panels`; screenshot `03` |
| Médecin | consultation, observations, diagnosis, read patient identity | tariffs, config, payment, patient.create | integration `gate3`; screenshot `04` |
| Caissier | read/use tariffs, invoice, payment, receipt | mutate tariffs, clinical structure, config | E2E `E2E-04`; integration `gate4-billing-tariff`; screenshot `05`,`06` |
| Directeur (LS) | dashboard, audit read, config **read-only**, patient/invoice read | any create/modify | E2E `E2E-05`; component `sidebar`; integration `audit` |

> UI hides unavailable actions for convenience; **server-side RBAC is the real control**
> (Gate 3 services + `requireCapability`), proven by the integration suite, not just the UI.

## Screenshot index (Gate 4 set — `docs/gate4-screenshots/`, fake data, production mode)
| # | File | Role | Proves |
|---|---|---|---|
| 1 | `01-administration-config.png` | Administrateur | Config UI (dept/unit/setting/template), create/deactivate |
| 2 | `02-tarifs.png` | Administrateur | Tariff/price-list management, integer FCFA |
| 3 | `03-patient-identite.png` | Agent d'accueil | Identity/contact panel + duplicate notice (**no merge**) |
| 4 | `04-consultation-clinique.png` | Médecin | Structured observations + diagnosis beside free-text |
| 5 | `05-facturation-tarifs.png` | Caissier | **DB-sourced** tariff catalogue in billing |
| 6 | `06-recu.png` | Caissier | Official receipt (Payment + Sequence; prototype label) |
| 7 | `07-journal-audit.png` | Administrateur | Audit log with new Gate 3/4 event labels (French) |

(Earlier per-gate screenshots also exist under `docs/review-screenshots/`, `docs/stakeholder-demo-screenshots/`.)

## Known limitations (non-blocking, fake-data scope)
- Real-data use, production deployment and mobile readiness are **not** authorized/claimed.
- Cashier **daily report** (`12 §5.12`) and **basic export** (`§5.16`) are Phase 1 scope items **not yet built**.
- Duplicate detection is **manual** (flag/review); automatic at-registration is a mentor decision.
- Sensitive-**read** audit policy is **`à confirmer par le MINSANTE`** (not implemented).
- Full user-account lifecycle UI (create/deactivate users, assign roles) is **not yet built** (services exist).
- Legal EMR/signature/archival rules pending MINSANTE confirmation.
