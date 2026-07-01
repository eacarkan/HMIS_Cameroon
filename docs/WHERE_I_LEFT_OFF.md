# Where I left off

**Date:** 2026-06-27
**State:** ✅ **The first walking skeleton (build Steps 1–13, `09 §14`) is complete,
verified, and pushed.** All acceptance criteria (`02`) are met.

---

## What exists

The full golden path works end-to-end, French-first, hospital-scoped, with RBAC and
audit: **login → select hospital → create patient → open visit → record consultation →
create invoice → record payment → print receipt → dashboard tile → audit log**.

- Foundations: Next.js 16 App Router shell, Design System v0, next-intl (FR), Prisma 7 +
  PostgreSQL, integer FCFA, UI→service→data-access boundary (ESLint).
- Auth.js login + JWT sessions; active-hospital context (cookie) + scoping; RBAC matrix
  enforced in the service layer (denied actions fail server-side + `authz.denied`).
- Patient (banner, search-before-create, numbering), encounter, consultation, billing
  (3 000 FCFA), official receipt (react-to-print), real dashboard KPIs, audit log view.
- Deterministic numbers: `HRB-DEMO-P/V/F/R-2026-000001`.

## Verify it

```bash
npm run db:reset     # known starting state
npm run smoke        # golden-path assertions (numbering, 3 000 FCFA, audit, RBAC, scoping)
npm run dev          # http://localhost:3000  (see docs/DEMO.md for the live script)
```

`npm run build` / `lint` / `typecheck` all pass. Proof-of-work screenshots in
`docs/screenshots/` (01–14). Per-step logs in `docs/build-log/`. Decisions in
`docs/adr/` (ADR-0000…0003).

## What is deliberately NOT here (later increments / post-audit)

Duplicate/MPI, prescription, lab, pharmacy, structured diagnosis/vitals, multiple
dashboard tiles/charts, real tariffs, integrations (DHIS2/FHIR), offline sync,
production hosting/cybersecurity (`01 §4`, `05 §10`).

## Possible next directions

- Thicken modules per audit findings (real tariffs, registration workflow, roles).
- Add the Vitest unit tests + Playwright golden-path e2e (the service smoke test already
  covers reconciliation/audit; `npm run smoke`).
- Multi-hospital users (the scoping mechanism already supports it).
