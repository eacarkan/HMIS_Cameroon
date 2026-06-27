# Where I left off

**Date:** 2026-06-27
**Increment:** Foundations — build sequence **Steps 1-2** (+ seed/reset stubs from
Step 3), per `09 §14` and kickoff `10`.
**State:** ✅ Done and verified. `next build` passes, `next dev` runs, the French
shell renders, Prisma connects to local PostgreSQL.

---

## What exists now

- **App boots** with `npm run dev` → http://localhost:3000. The French shell renders:
  deep blue-green sidebar (Tableau de bord, Patients, Consultations, Facturation,
  Administration, Journal d'audit), top bar (hospital-context + user/role + language
  placeholders), the page-header pattern, and the persistent prototype label.
  See `docs/screenshots/01-tableau-de-bord.png` and `02-patients-a-venir.png`.
- **Empty dashboard** at `/` with placeholder KPI tiles (show "—", no real data); the
  other modules are "à venir" placeholder routes.
- **Folder structure** matches `09 §2` (with services/data-access nested under
  `server/` per ADR-0001).
- **Dependency direction wired** UI → `server/actions` → `server/services` →
  hospital-scoped `server/db` → Prisma; services/authz are stubs; the UI→Prisma ban is
  enforced by ESLint, not just documented.
- **Design tokens** reflect Design System v0 (`06 §3-4`); **next-intl** serves French
  from `messages/fr.json`; **lib/money** formats integer FCFA as "15 000 FCFA".
- **Prisma 7** configured with the node-postgres adapter; `npm run db:check` proves the
  live connection through the service layer.
- **Git**: 10 small atomic commits referencing register IDs; `.gitignore` excludes
  node_modules / .next / .env*.

## Verification done

- `npm run build` → ✓ compiled, TypeScript clean, 6 static routes.
- `npm run lint` → ✓ clean (incl. the import guardrail).
- `npm run db:check` → ✓ PostgreSQL OK.
- Screenshots captured (proof of work, `08 §8`).

## Environment notes (for the next session)

- Local PostgreSQL: Homebrew `postgresql@14` (a fresh cluster was initialized at
  `/opt/homebrew/var/postgresql@14`). DB `hmis_cameroon`, role `hmis` /
  `hmis_dev_password`. `DATABASE_URL` is in `.env` (gitignored); see `.env.example`.
- Start DB if needed: `brew services start postgresql@14`.

## What is intentionally NOT here (deferred)

- No auth/RBAC logic, no patient/encounter/consultation/billing/receipt flows, no
  printing. No real data — fake only. The Prisma schema is empty (no models yet).

## Next step — Step 3 (fake demo data concept)

Per `07_Demo_Scenario_and_Fake_Dataset`:
1. Add the domain models to `prisma/schema.prisma` (Hospital, User, Role, Patient,
   Encounter, Consultation, Invoice, InvoiceItem, Payment, AuditLog, Sequence) — all
   hospital-scoped, integer FCFA.
2. Implement `scripts/seed.ts` / `scripts/reset.ts`: one demo hospital (HRB-DEMO), five
   fictional users/roles, deterministic identifiers (e.g. `HRB-DEMO-P-2026-000001`), and
   the reconciling 3 000 FCFA journey. Fake data only.
3. Then Step 4 (auth shell) and Step 5 (hospital selector + scoping), at which point the
   placeholders in `server/db/hospital-context.ts`, `server/authz`, and the top-bar
   user/hospital slots get wired for real.
