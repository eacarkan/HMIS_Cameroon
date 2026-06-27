# Step 1–2 — Foundations (repo + app shell + design + i18n)

**Date:** 2026-06-27 · **ADRs:** [ADR-0000](../adr/ADR-0000-stack-and-architecture-reference.md),
[ADR-0001](../adr/ADR-0001-foundation-implementation.md)

## Implemented
- Next.js 16 (App Router) + TS + Tailwind v4 + shadcn/ui scaffold; ESLint + Prettier.
- Folder structure per `09 §2`: `app/`, `components/{ui,layout,forms,tables,print}/`,
  `features/`, `server/{actions,authz,services,db}/`, `lib/{money,dates,validation,constants}/`,
  `prisma/`, `messages/fr.json`, `scripts/`, `tests/`, `docs/`.
- French design shell (06): deep blue-green sidebar, top bar, page-header pattern,
  persistent prototype label; empty "Tableau de bord" + "à venir" routes.
- Design tokens (06 §3-4): institutional blue-green primary, slate neutrals, semantic
  colors, Inter + tabular numerals.
- next-intl (French only, no routing) + `messages/fr.json` glossary.
- Prisma 7 + node-postgres adapter to local PostgreSQL (empty schema); `lib/money`
  integer FCFA formatting; UI→service→data-access boundary enforced by ESLint.
- `scripts/` seed/reset/check-db stubs; one-command `npm run dev`.

## Verified
`npm run build` ✓, lint ✓, typecheck ✓, `db:check` ✓ (live PostgreSQL). Screenshots
01–02. 10 atomic commits.
