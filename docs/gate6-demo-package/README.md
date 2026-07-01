# Gate 6 — MINSANTE Demonstration / Pilot-Readiness Package

**Project:** MINSANTE SIGH/DME (HMIS/EMR) — French-first prototype
**Status:** Draft for mentor review · **Date:** 2026-06-28 · **Branch:** `feature/gate4-ui-workflows`
**Boundary:** **fake/demo data only — not production — not authorized for real patient data**

## Purpose of this folder
This folder is the **controlled demonstration and pilot-readiness review package** for the Ministry of Public Health (MINSANTE). It consolidates the evidence produced across Gates 2–5B and frames, honestly, what the Phase 1 pilot-core foundation demonstrates and what still requires MINSANTE confirmation, hospital audit, and **Gate 7** authorization before any real use.

This package supports a **controlled demonstration** and a **pilot-readiness review**. It does **not** declare production readiness and does **not** authorize hospital operational use.

## What this package contains
| File | Purpose |
|---|---|
| `README.md` | This overview and usage guide. |
| `DEMO_SCRIPT.md` | Role-based, step-by-step demonstration script with speaking notes and expected evidence. |
| `DEMO_SCOPE_AND_LIMITATIONS.md` | Table: demonstrated capability · evidence path · status · limitation · decision required. |
| `MINSANTE_DECISIONS_NEEDED.md` | Decision table for MINSANTE (why · owner · timing · risk · `à confirmer par le MINSANTE`). |
| `REAL_DATA_AND_PRODUCTION_BLOCKERS.md` | Blockers that must be cleared (Gate 7) before real data / operational use. |
| `SCREENSHOT_INDEX.md` | Index of existing screenshots (path · workflow · role · what it proves · limitation). |
| `UAT_AND_TEST_EVIDENCE_INDEX.md` | Index of UAT and test evidence with latest command results. |
| `COMMERCIAL_PROTECTION_NOTE.md` | Confidentiality and commercial-protection wording. |
| `ROLE_BASED_DEMO_USERS_REDACTED.md` | Redacted role/name reference (no passwords). |
| `command-output.txt` | Latest verification command transcript (typecheck/lint/build/tests/smoke/guardrails). |

### French external-facing versions (MINSANTE-facing)
The English files above are the internal repository package. For MINSANTE, use the formal **French** versions:
| File (FR) | Corresponds to |
|---|---|
| `NOTE_DE_PRESENTATION_DEMONSTRATION.md` | Presentation note (this README / positioning) |
| `NOTE_DE_PROTECTION_COMMERCIALE.md` | `COMMERCIAL_PROTECTION_NOTE.md` |
| `DECISIONS_ATTENDUES_DU_MINSANTE.md` | `MINSANTE_DECISIONS_NEEDED.md` |
| `BLOQUANTS_AVANT_DONNEES_REELLES_ET_EXPLOITATION.md` | `REAL_DATA_AND_PRODUCTION_BLOCKERS.md` |
| `SCRIPT_DE_DEMONSTRATION.md` | `DEMO_SCRIPT.md` |

The companion gate report is `03_Software/Planning/29_Gate_6_Pilot_Readiness_Demonstration_Package.md`.

## How to use it for the MINSANTE demonstration
1. Read `DEMO_SCOPE_AND_LIMITATIONS.md` and `REAL_DATA_AND_PRODUCTION_BLOCKERS.md` to set expectations.
2. Open the boundaries statement at the start of `DEMO_SCRIPT.md` and present it **before** any screen.
3. Follow the role-based flow in `DEMO_SCRIPT.md` (≈60–90 minutes): login & hospital context → patient flow → clinical flow → billing/receipt/cashier → admin/user lifecycle → audit/RBAC → known limitations → decisions needed.
4. Obtain demo credentials **separately through a controlled channel** (see `ROLE_BASED_DEMO_USERS_REDACTED.md`); they are **not** in this repository.
5. Close with `MINSANTE_DECISIONS_NEEDED.md` to collect decisions.

## ⚠️ Fake / demo data warning
All hospitals, users, roles, patients, tariffs, invoices, and payments are **fictional and seeded**. The active demonstration hospital is **HRB-DEMO** (« Hôpital Régional de Bertoua — Démo »). There is **no connection** to any live system, registry, or hospital database.

## ⚠️ No real patient data
This package and the demonstration must **never** use real patient data. Real-data use requires **Gate 7** (written MINSANTE authorization + hosting/security/data-protection/training/acceptance readiness).

## ⚠️ No production use
The system is **not ready for production use** and is **not** authorized for hospital operational use. The in-app and printed prototype label reads: « Prototype de démonstration fonctionnelle — non destiné à la production ».

## Screenshots and UAT evidence
- Screenshots: `docs/gate4-screenshots/` (7 screens + README), `docs/gate5b-screenshots/` (2 screens) — indexed in `SCREENSHOT_INDEX.md`.
- UAT / tests: `docs/gate5-evidence/` (README, UAT checklist, command output), `docs/testing/` (Phase 0 UAT) — indexed in `UAT_AND_TEST_EVIDENCE_INDEX.md`.

## Controlled distribution / confidentiality
This package is **confidential** and is shared **only for technical review and demonstration**. It does **not** transfer intellectual property, source code, full technical/security architecture, deployment topology, financial model, or supplier strategy. Deeper disclosure requires a written mandate and confidentiality / reimbursement protection. See `COMMERCIAL_PROTECTION_NOTE.md`.
