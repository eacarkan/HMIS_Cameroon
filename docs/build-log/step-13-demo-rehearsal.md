# Step 13 — Demo rehearsal + proof-of-work

**Date:** 2026-06-27 · **Planning:** 02 (acceptance criteria), 07 §12

## Implemented
- **Golden-path smoke test** (`scripts/golden-path.ts`, `npm run smoke`): resets to the
  known demo state and replays the full journey through the service layer, asserting the
  acceptance-critical outcomes. Doubles as the 09 §11 smoke + reconciliation + audit test.
- **Demo guide** (`docs/DEMO.md`): the 14-step live-demo script + the acceptance checklist.
- Proof-of-work screenshots 12–14 (dashboard with data, audit log, encounter view).

## Verified — `npm run smoke` (all ✓)
patient `HRB-DEMO-P-2026-000001` · encounter `…V-…000001` · hospital scoping (cross
denied) · consultation · invoice `…F-…000001` total 3 000 · receipt `…R-…000001` ·
**reconciliation total = items = payment = 3 000, Payée** · **RBAC block** (reception
cannot encaisser) · **dashboard 1 / 1 / 3 000 FCFA** · audit chain present.

## Acceptance criteria (02) — all met
Functional: role login + visible RBAC · hospital selection + scoping · patient ·
encounter · consultation · invoice/payment (FCFA) · official receipt · dashboard tile ·
audit log. Cross-cutting: French UI · fake data only · prototype label (app + receipt) ·
hospital scoping at data access · authorization blocked server-side (not just hidden) ·
unique per-hospital numbering. Quality: stable golden path · data persists · clean
monochrome receipt · one-command run + seed/reset/smoke.

**The first walking skeleton is complete and demoable.**
