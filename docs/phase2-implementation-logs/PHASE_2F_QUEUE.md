# Phase 2F — Simple Per-Service Digital Queue

**For:** mentor review · **Data:** synthetic / fake only · **Branch:** `feature/phase2f-queue` (stacked on the Phase 2 core tip `62db7d7`)
**Boundaries:** synthetic-data UAT only · not Gate 7 · no real data · **no printed tickets / display screens / appointment scheduling / SMS-email notifications.**

## 1. Objective
A simple **per-service digital queue** (outpatient / lab / pharmacy) replacing the physical arrival register: a registered patient is queued for a service today, staff advance the status, and a triage override may flag a ticket urgent so it jumps the line.

## 2. Schema (additive — migration `…_phase2f_queue`)
- New enum **`QueueStatus`** (`waiting` / `in_service` / `completed` / `cancelled`) + model **`QueueTicket`** (serviceUnitId, patientId, `queueDate` @db.Date, `ticketNumber`, status, `isUrgent`, called/completed/cancelled stamps). `@@unique([hospitalId, serviceUnitId, queueDate, ticketNumber])` guarantees per-service-per-day numbering. No drops/renames.

## 3. Behaviour
- **Numbering** is sequential **per hospital + service + day** (resets daily): optimistic — read the current max, insert, retry on the unique-constraint clash — so numbers never collide or skip under concurrency.
- **State machine** (pure `lib/queue`): `waiting → in_service → completed`, and `waiting|in_service → cancelled`; any other transition is rejected. Terminal: completed / cancelled.
- **Ordering**: urgent tickets first, then by ticket number.
- **Urgent override** flags/unflags an active ticket so it jumps the line (audited).

## 4. RBAC + audit
- New capabilities **`queue.read`** (all operational + oversight roles), **`queue.manage`** (reception/triage, doctor, pharmacy — add + advance), **`queue.urgent`** (reception/triage + doctor — the line-jump override). The cashier/director/admin are read-only; pharmacy manages but cannot flag urgent. (The placeholder's "triage nurse" maps to the reception/triage desk + clinician in this prototype — there is no separate nurse role.)
- Audit: `queue.ticket_created`, `queue.status_changed`, `queue.marked_urgent` (+ French labels). Hospital-scoped; append-only.

## 5. Service / UI
- Pure `lib/queue.ts` (state machine, ordering, ticket formatting). `server/db/queue-tickets.ts` (optimistic create, board list, guarded status/urgent updates) + `findPatientByNumber`. `server/services/queue-service.ts` (getQueueForService, addToQueue, advanceQueueTicket, setQueueUrgent — `now` injectable for tests). `server/actions/queue-actions.ts`.
- UI: **`/file-attente`** — a service selector, an add-to-queue form (patient number + urgent checkbox for triage), and the live board (ticket number, patient, status/urgent badges, call/complete/cancel + urgent-toggle controls). Nav "File d'attente" (`queue.read`). Fr `queue` namespace; English falls back to the base.

## 6. Tests + results
- **Unit (`queue`):** transition rules (valid/invalid), terminal detection, urgent-first ordering, zero-padded number. **`rbac`:** the queue capability split across roles.
- **Integration (`queue-2f`):** sequential per-service-per-day numbering + audit; **no duplicate number under concurrent adds**; the state machine (invalid transition rejected, called/completed stamps); the urgent override needs `queue.urgent` and re-orders the board; RBAC (cashier cannot add); scoping (a foreign-hospital patient number is not found).
- **Component (`queue-2f`):** add form (urgent shown only for triage) + board (manager actions; read-only viewer has none; empty state).
- **E2E (`queue-2f`):** reception queues the golden-path patient → calls → completes; a read-only role sees the board but no add control. Sorts after the golden path.

**Results (cumulative):** typecheck ✓ · lint ✓ · unit + component ✓ · integration ✓ · build ✓ · e2e ✓ · smoke GOLDEN PATH ✓ · check:arch ✓ · check:privacy ✓.

## 7. Boundaries respected
Synthetic/fake data only · not Gate 7 · no real data · no printed tickets/screens/scheduling/notifications · per-day numbering · invalid transitions rejected · urgent override audited · integer numbers · hospital-scoped · additive schema.

## 8. Confirmation
This is Phase 2F only (the first of the optional 2F–2J extensions, built at the user's request after the 2A–2E core). No tickets/screens/scheduling/notifications.
