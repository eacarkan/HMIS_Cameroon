# Step 12 — Audit log view

**Date:** 2026-06-27 · **Planning:** 06 §10, 09 §7, 07 §11

## Implemented
- **Audit data-access** (`server/db/audit.findAuditEntries`): hospital-scoped list,
  newest first, optional action filter, with the actor.
- **Audit service** (`audit-service.listAuditEntries`): read-only; requires
  `audit.read` (denied read throws without spamming the log). Uses `can()` directly to
  avoid an authz↔audit service cycle.
- **UI**: Journal d'audit page (`/journal-audit`) — compact table (date/heure · acteur ·
  action · entité · résumé) with a light action filter; `authz.denied` rows flagged.
  `AUDIT_ACTION_LABELS` (French) for the dotted action codes.

## Verified
Directeur reads the log (entries incl. the golden path); filter `payment.record` → 1
entry; reception **denied** `audit.read` (nav hidden + page guarded). build/lint/
typecheck ✓.
