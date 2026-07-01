# Step 3 — Fake demo data

**Date:** 2026-06-27 · **ADR:** [ADR-0002](../adr/ADR-0002-data-model-skeleton.md) ·
**Planning:** 05, 07

## Implemented
- Prisma schema for the 11-entity walking-skeleton subset + `UserRole` + enums
  (`prisma/schema.prisma`); migration `…_init_skeleton_models` applied. Hospital-scoped,
  integer FCFA, soft-delete, neutral status codes, per-hospital `Sequence` numbering.
- `lib/numbering` — deterministic format `HRB-DEMO-P-2026-000001` (P/V/F/R).
- Idempotent seed/reset (`prisma/seed-data.ts`, `scripts/seed.ts`, `scripts/reset.ts`):
  8 hospitals (HRB-DEMO active+demo, 7 inactive), 5 roles, 5 users (bcrypt `HMIS_DEMO_SHARED_PASSWORD`)
  + role assignments @ HRB-DEMO, zeroed 2026 sequences. No patient/encounter/invoice.
- `prisma.config.ts` wires `migrations.seed`.

## Verified
`db:seed` (idempotent) ✓, `db:reset` ✓, rows confirmed via psql; build/lint/typecheck ✓.
4 atomic commits.
