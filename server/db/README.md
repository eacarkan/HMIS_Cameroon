# server/db — hospital-scoped data-access

The **only** layer that touches Prisma (09 §2, §4). Rules:

- Every domain function added here (from Step 3+) takes a `HospitalContext` and
  filters by it — "a query without a hospital context is a defect" (09 §5).
- Consumers are `server/services` only. The UI (pages, components, features) must
  not import this layer — enforced by ESLint `no-restricted-imports`.
- `prisma.ts` is the single Prisma client (Prisma 7 + node-postgres adapter).

Foundation files: `prisma.ts` (client), `hospital-context.ts` (context type +
placeholder, real selector at Step 5), `health.ts` (infra connectivity check).
