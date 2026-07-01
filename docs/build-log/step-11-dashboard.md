# Step 11 — Dashboard tile (real data)

**Date:** 2026-06-27 · **Planning:** 06 §11, 07 §10

## Implemented
- **Dashboard data-access** (`server/db/dashboard`): patients registered since
  midnight, open encounters, collections since midnight (sum of recorded payments),
  recent audit entries — all hospital-scoped.
- **Dashboard service** (`dashboard-service.getDashboardSummary`): authorizes
  (`dashboard.read`), gathers the KPIs for the active hospital + today.
- **UI**: the `Tableau de bord` tiles now show real values — Patients enregistrés
  aujourd'hui, Visites ouvertes, Encaissements du jour (FCFA) — plus a recent-activity
  feed from the audit log. `lib/dates.startOfToday`.

## Verified
After the golden path: KPIs = **1 / 1 / 3 000 FCFA** (matches 07 §10); recent activity
lists the latest audit entries. Read-only Directeur can view the dashboard.
build/lint/typecheck ✓. (Dashboard-with-data screenshot captured in the Step 13 rehearsal.)
