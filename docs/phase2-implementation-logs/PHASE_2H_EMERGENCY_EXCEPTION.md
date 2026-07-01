# Phase 2H — Emergency Payment Exception (treat first, pay later)

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2h-emergency` (stacked on 2F `d3aed1a`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · no ambulance/pre-hospital module · no emergency clinical decision support.

## 1. Objective
A controlled **"treat first, pay later"** emergency exception: a triage nurse/doctor flags an encounter as emergency, which lets dispensing **bypass the cashier paid-check**; the resulting charges accrue as an **auditable Emergency Debt** ledger that must be **settled (cashier)** or **waived (Hospital Director)** before discharge.

## 2. Schema (additive — migration `…_phase2h_emergency_exception`)
- **`Encounter`** += `isEmergency` (Boolean, default false) + `emergencyFlaggedById`/`emergencyFlaggedAt`.
- New enum **`EmergencyDebtStatus`** (`outstanding`/`settled`/`waived`) + model **`EmergencyDebt`** (encounter, patient, integer `amount` FCFA, `source`, status, decidedById/decisionReason/decidedAt). **Append-and-transition only** — entries are never deleted, so debt can never silently disappear.

## 3. Behaviour
- **Emergency flag** (`emergency.flag`, triage/doctor): toggles `Encounter.isEmergency`; un-flagging is refused while outstanding debt exists. Audited.
- **Cashier-lock bypass**: `dispensePrescription` (2D-5) now bypasses the `isPaid` paid-check when the prescription's encounter is emergency (the dispense audit records "(URGENCE — paiement différé)"). A non-emergency unpaid prescription is still blocked.
- **Emergency Debt ledger**: `accrueEmergencyDebt` (`emergency.debt.accrue`, cashier) — only on an emergency encounter, positive integer amount + mandatory source. `settleEmergencyDebt` (`emergency.debt.settle`, cashier) and `waiveEmergencyDebt` (`emergency.debt.waive`, **Hospital Director only**, mandatory reason) transition `outstanding → settled/waived` (guarded so a double-decision loses). `getEmergencyDebtSummary` shows entries + the outstanding total.
- **Discharge gate**: `countOutstandingEmergencyDebt` (consumed by 2G discharge).

## 4. RBAC + audit
- New capabilities: **`emergency.flag`** (agent_accueil + medecin), **`emergency.debt.accrue`** + **`emergency.debt.settle`** (caissier), **`emergency.debt.waive`** (**directeur only** — the Hospital Director), **`emergency.debt.read`** (clinical + financial + oversight). Strict separation: the cashier accrues/settles but cannot waive; only the Director waives; clinicians flag but do not touch money.
- Audit: `emergency.flagged`, `emergency.debt_accrued`, `emergency.debt_settled`, `emergency.debt_waived` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/emergency.ts` (validate, can-decide, sum-outstanding, has-outstanding). `server/db/emergency.ts` (flag, ledger CRUD, guarded decide, outstanding count). `server/services/emergency-service.ts`. `server/actions/emergency-actions.ts`. The 2D-5 dispensing service gained the emergency bypass.
- UI: an **Urgence & dette d'urgence** card on the encounter page (`components/emergency/emergency-controls.tsx`) — flag toggle, accrue form, and the debt ledger with per-entry settle / director-waive controls, all capability-gated. Fr `emergency` namespace; English falls back to the base.

## 6. Tests + results
- **Unit (`emergency`):** amount/source validation, decide-guard, outstanding sum/any. **`rbac`:** the flag/accrue/settle/waive split — **waive is director-only**.
- **Integration (`emergency-2h`):** dispensing **bypasses** the paid-check on an emergency encounter (audit notes URGENCE) while a non-emergency unpaid prescription is still blocked; accrue only on an emergency encounter + cap; settle reduces the outstanding total; **only the Director may waive (with reason); the cashier cannot; double-decide rejected**; an encounter cannot be un-flagged with outstanding debt.
- **Component (`emergency-2h`):** the flag/accrue/ledger UI with capability gating (no waive control without the cap).
- **E2E (`urgence-2h`):** reception flags emergency → cashier accrues a debt → the Hospital Director waives it with a reason. Sorts after the golden path.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · emergency flag triage/doctor-only + audited · cashier-lock bypass only under emergency · **debt ledger append-and-transition only (cannot disappear)** · **waiver = Hospital Director only + reason** · discharge gate (2G) · integer FCFA · hospital-scoped · additive schema.

## 8. Confirmation
This is Phase 2H. It provides the emergency bypass + debt hooks consumed by 2D dispensing now and by 2G discharge and 2I lab/radiology payment-bypass next. No ambulance/pre-hospital module; no clinical decision support.

## 9. Adversarial review + hardening
A 5-agent security review (4 dimensions: bypass-security, debt-integrity, RBAC-separation, test-integrity + a skeptical verify pass) surfaced **one confirmed blocker** and no minor findings.

- **BLOCKER — race condition (debt-integrity), fixed.** The original un-flag path did a non-atomic check-then-act: it counted outstanding debt, then cleared `Encounter.isEmergency` in a separate write. A concurrent `accrueEmergencyDebt` could interleave between the count and the clear, leaving `isEmergency=false` **with** outstanding debt — breaking the invariant the discharge gate (2G) and billing rely on.
  - **Fix (`server/db/emergency.ts`):** both operations now serialise on the encounter row's write lock. `accrueEmergencyDebtTx` runs in a `$transaction` whose guarded `updateMany(where isEmergency:true)` both **re-asserts** the flag and **locks** the encounter row before inserting the debt. `unflagEncounterEmergencyTx` runs in a `$transaction` that **locks the encounter row first**, then re-counts outstanding debt under that lock, then clears the flag only if none remain. Whichever transaction acquires the lock first wins: if accrual commits first the un-flag sees the debt and is refused; if the un-flag commits first the accrual's `where isEmergency:true` matches zero rows and is refused. Neither order can reach the bad state.
  - **Regression test:** `tests/integration/emergency-2h.test.ts` — *"concurrent un-flag vs accrual never leaves a non-emergency encounter WITH outstanding debt"* fires both operations concurrently across several fresh encounters and asserts the invariant `isEmergency=false ⇒ no outstanding debt` after each.
  - The service pre-checks (`!encounter.isEmergency` on accrue; the un-flag debt guard) are retained as fast, clear UX failures; the transactional guards are the authoritative invariant.
