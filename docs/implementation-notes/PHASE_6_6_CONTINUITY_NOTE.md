# Phase 6.6 — Service continuity note (online-only operation)

**Status:** honest online-only statement + after-the-fact reconciliation procedure. **No offline engineering
is in scope for this phase** — this is documentation + an authenticated in-app note, not an offline mode.

## How SantéGrid operates
SantéGrid is an **online** web application. Normal cashier, billing and finance operations require the
application and its database to be reachable.

## During a network or power outage
1. **Fall back to paper.** Collections and deposits are recorded temporarily on the hospital's paper
   register / bordereau (the existing manual process), exactly as before the software.
2. **No data is created offline in the app.** There is no offline cache and no local queue — attempting to
   use the app while it is unreachable simply fails; nothing is silently lost or half-written.

## After the service returns
3. **Re-enter and reconcile.** The paper-recorded collections are entered into the application through the
   normal controlled paths (`recordPayment`), and the day's deposits are grouped into a **deposit slip** and
   **reconciled** against the (synthetic) bank statement in the finance workspace
   (`/facturation/rapprochement`). Every re-entry is audited.
4. **The money path is unchanged.** Re-entry uses the same atomic `recordPayment → recordPaymentTx` (F-01)
   rule as any other payment; reconciliation remains **metadata-only** and never rewrites an invoice,
   payment or receipt.

## In-app note
The same statement is surfaced to authenticated finance users on the finance workspace
(`/facturation`, "Continuité de service") so operators see the after-the-fact reconciliation procedure in
context. Synthetic review environment — no real patient or financial data.

## Explicitly NOT in this phase
- No offline mode, no service worker, no local database, no sync engine.
- No automated recovery — re-entry is a deliberate, audited human step.
