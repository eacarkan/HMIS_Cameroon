# ADR-0000 — Stack & Architecture (reference)

**Status:** Accepted (canonical document lives in the planning baseline).

This repository implements the decision recorded in **ADR-0**:

> `03_Software/Planning/03_ADR-0_Stack_and_Architecture.md`

ADR-0 is the source of truth and is **not** restated here. In one line: a single
TypeScript **modular monolith** — Next.js (App Router) + Prisma/PostgreSQL +
Tailwind/shadcn + Auth.js (with custom service-layer RBAC) + next-intl — with
business logic in a `services` layer, thin transport (Server Actions), hospital-scoped
data access from day one, and integer FCFA money.

Related register decisions (`08_Project_Registers.md`): D-001 (TypeScript end-to-end),
D-002 (Next.js modular monolith), D-003 (PostgreSQL + Prisma), D-004 (Tailwind +
shadcn/ui), D-005 (Auth.js + custom RBAC), D-007 (French-first UI), D-009 (FCFA as
integers), D-010 (service-layer authz), D-011 (hospital-scoped data access),
D-012 (no direct Prisma from UI), D-013 (no microservices), D-014 (receipt printing).

New, implementation-level decisions taken while building this repository are recorded
as their own ADRs in this folder — see [ADR-0001](./ADR-0001-foundation-implementation.md).
