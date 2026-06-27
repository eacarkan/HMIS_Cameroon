# Correction pass — review-screenshot 404 fix

Date: 2026-06-27 · Scope: docs + dev/QA tooling only (no product code).

## Problem

Five review screenshots (`05-patient-detail-banner`, `06-encounter`, `07-consultation`,
`09-payment-status`, `10-receipt-preview`) showed Next.js **404 "This page could not be
found"** inside the app shell.

## Exact cause (investigated, not guessed)

The id-bearing detail routes (`/patients/[id]`, `/encounters/[id]`, `/factures/[id]`,
`/recus/[id]`) resolve their record by **internal route ID** — a per-row `cuid` from
Prisma `@default(cuid())`. Only the human-readable *numbers* (`HRB-DEMO-P-2026-000001`)
are deterministic; the cuids are **regenerated on every reseed**. The previous capture
read the cuids from one seed, but the test DB was reseeded again before/between captures
(each `smoke:test` / golden-path run does `clearOperationalData` + a fresh golden path),
so those cuids no longer existed. `getX()` returned `null` → `notFound()` → Next 404.
Pages not keyed by a specific cuid (dashboard, list, search, create, audit) and the
billing page (a freshly-created encounter) were unaffected — which is exactly the broken
vs working split observed.

Reproduction confirmed the routes/guards/data-access are correct: a server started on the
test DB with a cuid read from that same DB renders the real record (Aïssatou BELLO,
`…P-2026-000001`). So it was a capture **state mismatch**, not a code defect.

## Fix (deterministic, self-validating, production-mode)

`npm run screenshots:review` → `scripts/capture-review-screenshots.sh`:
1. `next build` + `next start` (production → **no dev overlay**), server pinned to the
   TEST DB (refuses any non-"test" DB name).
2. `scripts/seed-review-fixture.ts` resets + replays the golden path through the service
   layer in one ordered step and emits the **real cuids** as JSON.
3. `scripts/capture-review-screenshots.mjs` visits valid routes only and **refuses to
   save** any page containing `404` / "This page could not be found", missing the
   prototype label, or missing expected content (and checks nav placeholders are not
   404). No broken page can be saved silently.

Two capture-pipeline bugs found and fixed along the way: (a) the orchestrator read env via
`dotenv.config()` in a shell `$(...)`, capturing dotenv v17's stdout banner into
`DATABASE_URL` (corrupted host) — now reads `.env` directly; (b) `innerText` reflects CSS
`text-transform`, so the uppercased receipt header failed a case-sensitive check — token
matching is now case-insensitive.

## Result

All 14 screenshots recaptured in production mode and validated (no 404, prototype label
present), fake data only. Added `14-rbac-audit-denied.png` (server-side `authz.denied`
audit entry) as stronger RBAC evidence. Command outputs saved under
`docs/qa-command-output/`; executed UAT at
`docs/testing/UAT_PHASE_0_WALKING_SKELETON_EXECUTED.md`.
