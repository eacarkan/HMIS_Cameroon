# ADR-0001 — Foundation implementation choices (Steps 1-2)

**Status:** Accepted · **Date:** 2026-06-27 · **Scope:** repo initialization + app
shell + design foundation (build sequence Steps 1-2, `09 §14`).

This ADR records the concrete, implementation-level choices made while standing up
the repository. None of them change ADR-0; they fill gaps ADR-0 left open and note
where a newer library shape forced a small deviation from older conventions.

---

## 1. `services` and `data-access` live under `server/`

`09 §2` lists `server/`, `services/` and `data-access/` as sibling responsibilities,
while the kickoff prompt (`10`) specifies `server/{actions,authz,services,db}/`. We
followed the kickoff layout: services and the hospital-scoped data-access layer live
**inside** `server/` (`server/services`, `server/db`). The dependency direction and
the rule set are unchanged — only the directory nesting differs. `server/db` is the
data-access layer (the only place Prisma is called).

**Flow (unchanged):** UI → `server/actions` → `server/services` → `server/db`
(hospital-scoped) → Prisma.

## 2. Prisma 7 driver adapter + `prisma.config.ts`

Prisma 7 removed `url` from the schema `datasource` and no longer bundles a query
engine by default. Consequences for this repo:

- The connection URL for the CLI (migrate / db push / introspect) lives in
  `prisma.config.ts` (loaded via `dotenv/config`), not in `schema.prisma`.
- The runtime `PrismaClient` is constructed with the **node-postgres driver adapter**
  (`@prisma/adapter-pg` + `pg`) in `server/db/prisma.ts`.
- The schema is intentionally empty in this step (no models) — domain models arrive at
  Step 3+ per `05_Logical_Data_Model_v0`.

## 3. The UI→service→data-access boundary is enforced, not just documented

`D-012` ("no direct Prisma calls from UI/pages") is enforced by an ESLint
`no-restricted-imports` rule that forbids `@prisma/client`, `@prisma/adapter-pg`, `pg`
and `@/server/db*` imports from `app/`, `components/` and `features/`. We did **not**
use the `server-only` package on the Prisma module, because the seed/reset scripts run
outside Next and must still import it.

## 4. next-intl without i18n routing (French only)

The prototype is French-only (`D-007`), so next-intl is configured with a single fixed
locale and **no** `[locale]` route segment or middleware. All strings come from the
single glossary `messages/fr.json`.

## 5. Design tokens and theme

shadcn/ui was initialized (radix primitives, slate neutrals) and then re-themed in
`app/globals.css` to the Design System v0 palette (`06 §3`): institutional blue-green
primary `#0E5A6B`, slate neutrals, functional semantic colors, a deep blue-green
sidebar, Inter with tabular numerals. The app is **light-only**; the `.dark` block is
retained for shadcn compatibility but no toggle is shipped.

## 6. Stack versions pinned by scaffolding

Next.js 16, React 19, Tailwind v4, next-intl 4, Prisma 7, zod 4 — whatever
`create-next-app@latest` / `shadcn@latest` resolved on 2026-06-27. Recorded here so a
later reader knows the baseline.

---

### Consequence

The walking-skeleton increments (Steps 3-13) can be built without re-litigating
structure: folders, the request flow, money/i18n/scoping guardrails and the design
tokens are all in place and verified by a passing `next build` and a live DB check.
