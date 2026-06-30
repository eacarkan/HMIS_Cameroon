# Phase 2 — Independent Domain-Expert Audit

**Scope:** all Phase 2 (2A→2J) of HMIS Cameroon · **Data:** synthetic only · **not Gate 7.**
**Method:** (1) a 7-lens multi-agent evaluation — clinical-workflow, financial-integrity, pharmacy-stock, security-RBAC-scope, privacy-data-protection, concurrency-integrity, test-coverage-quality — each lens's blocker/major findings independently **adversarially verified** (32 agents, ~2.0M tokens); (2) a new **executable audit suite** (`tests/integration/phase2-expert-audit.test.ts`, 12 probes) that empirically attacks the critical invariants and documents the gaps. This audit was run on top of the mentor review; it is **independent** of it.

## Headline

- **The core safety/security invariants HOLD** and are now backed by executable probes (RBAC denial + audit, hospital scoping, the lab-result visibility gate, money reconciliation, the discharge gate).
- The audit found **2 NEW defects the mentor review did not surface — both are now FIXED with regression tests**:
  1. **BLOCKER (pharmaceutical safety):** the default FEFO path could **reserve and dispense EXPIRED stock**.
  2. **MAJOR (clinical lifecycle):** a **prescription could be created on a CLOSED encounter**.
- Every **other** confirmed finding (22) is an **already-documented, mentor-deferred pre-Gate-7 backlog item** (`docs/PRE_GATE7_HARDENING_BACKLOG.md`) — independent confirmation, not new. They are **not UAT blockers** and are intentionally **not changed** here.

## 1. Invariants that HOLD (executable evidence)
Each probe in `tests/integration/phase2-expert-audit.test.ts` actively tries to break the property:

| Property | Probe result |
|---|---|
| Capability RBAC denies cross-role actions **and audits each denial** (`authz.denied`); admin is not a clinical/billing superuser | ✅ holds (5 denials, 5 audit rows) |
| Hospital scoping — no foreign-hospital context (`selectHospital` refuses); DB reads are hospital-scoped | ✅ holds |
| **2I result-visibility gate** — the doctor is blind to `resultText` through ALL read paths (order, encounter list, worklist) until validated; staff see it; doctor sees it after validation | ✅ holds |
| Money reconciles exactly, integer FCFA, full billing journey | ✅ holds |
| **2G discharge gate** blocked by an unpaid invoice **and** by outstanding emergency debt | ✅ holds |
| **2H** encounter cannot be un-flagged while emergency debt is outstanding | ✅ holds |

## 2. NEW defects found by this audit — FIXED

### 2.1 BLOCKER — expired stock reservable/dispensable via the default FEFO path
**Where:** `lib/stock.ts` `allocateFefo` + `server/services/reservation-service.ts` `reserveForPrescription`.
**The bug:** `lib/stock.ts` correctly has `isExpired` (used by the 2D-6 override's `fefoBatchId`/`validateFefoOverride`), but **`allocateFefo` (the DEFAULT reservation path) did not filter expired lots**. `reserveForPrescription` passed `listStockForMedication(...)` (which returns expired batches) straight into `allocateFefo`, which sorts earliest-expiry-first and allocates from the front — so an **already-expired** batch is reserved ahead of valid stock, and dispensing (2D-5) then consumes that reservation. This defeats the entire purpose of expiry tracking — a patient-safety violation. It was invisible because the seed uses only future-dated lots and no test seeded an expired batch.
**Fix:** `reserveForPrescription` now filters `batches.filter(b => !isExpired(b.expiryDate, now))` before FEFO allocation; expired lots are removed via a stock adjustment (2D-7), never reserved/dispensed.
**Regression tests (3):** FEFO reserves only the valid lot when an expired + a valid lot exist; an expired-only medication reserves nothing (shortfall) and never the expired lot.

### 2.2 MAJOR — prescription creatable on a CLOSED encounter
**Where:** `server/services/prescription-service.ts` `createPrescription`.
**The bug:** the service fetched the encounter and checked existence, but **omitted the `encounter.status === 'open'` guard** that `diagnostic-service` and `hospitalization-service` both enforce — so an ordonnance could be written against a closed/cancelled visit, breaking the clinical-visit lifecycle.
**Fix:** added `if (encounter.status !== "open") throw "La visite doit être ouverte pour créer une ordonnance."`.
**Regression test:** prescription on a closed encounter is refused.

## 3. Confirmed KNOWN pre-Gate-7 backlog (independent confirmation — deferred, not changed)
The audit independently re-derived the mentor's hardening backlog. These are **real** but already documented and **scoped by the mentor as pre-real-data**, **not UAT blockers**. Summary (full detail + map in `docs/PRE_GATE7_HARDENING_BACKLOG.md`):

| Area | Confirmed finding(s) | Backlog # |
|---|---|---|
| **2C financial atomicity** | Invoice-cancellation approval is 4–6 separate writes, not one transaction (orphaned refund on crash) | #1 |
| **2C status guards** | Cancellation-request + RefundVoucher transitions use `updateMany(where {id,hospitalId})` without a status guard → concurrent double-decide both succeed (audit/`*ById` corruption) | #5 |
| **2C cashier shift** | One-open-shift is check-then-create (TOCTOU) with no DB constraint → two open shifts possible | #4 |
| **2C payments** | `recordPayment` reads remaining then writes, non-atomic → concurrent payments could exceed the total | #5/#12 |
| **2H / 2D-5 / 2I emergency** | Emergency bypass does not auto-create/link `EmergencyDebt` (discharge gate can miss an un-accrued charge) | #2 |
| **2I same-user** | No `validatedById ≠ resultEnteredById` guard — a user holding both caps can validate their own entry (executable probe confirms it) | #3 |
| **Audit atomicity** | Audit written after the committed transaction (consistent codebase pattern) | #13 |
| **Test gaps** | No concurrent double-decide tests for refund/cancellation/shift; cross-hospital test missing for 2D-7; emergency+dispense combined untested | #14 |

## 4. Minor / observations
- **Queue (2F):** no constraint stops one patient holding multiple active tickets for the same service/day (backlog #15 — a conscious workflow decision).
- **Audit-assertion strength (test quality):** several existing tests assert audit via `toContain(<number>)` (substring) rather than the full record (hospitalId + actorId + action enum + timestamp). Low-risk, but full-structure assertions would catch malformed audit rows. (The new audit suite asserts the `authz.denied` action + count precisely.)

## 5. Per-module expert verdict (from the 7 lenses)
- **Clinical (2B/2F/2G/2I):** strong — server-side state machines, transaction-locked discharge gate, correct result-visibility. The only genuine defect was the prescription open-encounter guard (now fixed).
- **Financial (2C/2G/2H):** correct **for synthetic UAT**; the high-risk money paths in 2C are not yet transactional/status-guarded to the standard 2G/2H already meet — a pre-real-data must-fix (backlog).
- **Pharmacy/stock (2D):** sound dispensing atomicity, dual validation, FEFO override, negative-stock guards — **except** the expired-FEFO default path (now fixed).
- **Security/RBAC/scope:** clean capability matrix + segregation of duties; hospital scoping enforced at `selectHospital` + every `server/db` query. The atomicity/status-guard gaps are the residual risk (backlog).
- **Privacy:** clean — DHIS2 CSV + operational/pharmacy reports are strictly aggregate (no identifiers); the visibility gate holds; audit carries no result text.
- **Concurrency:** 2D-5/2D-6/2D-7/2G/2H transactions are correctly guarded/locked; the 2C refund/cancellation/shift paths are the remaining hardening (backlog).
- **Test quality:** broad and honest on happy paths + RBAC denial; the gap is concurrent-double-decide on the financial paths and a couple of cross-module/cross-hospital combinations (backlog #14).

## 6. Overall verdict
**Confirmed: accepted for controlled synthetic-data UAT.** The two newly-found defects (expired-FEFO BLOCKER, prescription-on-closed-encounter MAJOR) are **fixed and regression-tested**. All remaining confirmed findings are the **known, mentor-deferred pre-Gate-7 hardening backlog** — real, documented, and **not** UAT blockers. **Gate 7 / real-data / production remain NOT approved** until the backlog (transactional + status-guarded financial flows, auto-coupled emergency debt, same-user validate guard, one-open-shift DB constraint, the missing concurrent/cross-hospital tests) is closed, alongside the organizational prerequisites (signed UAT, validated hardware, baseline cybersecurity assessment, MINSANTE authorization).
