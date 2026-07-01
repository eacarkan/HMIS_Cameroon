# Step 8 — Consultation (minimal)

**Date:** 2026-06-27 · **Planning:** 05 §4, 06 §14, 07 §7

## Implemented
- **Consultation data-access** (`server/db/consultations`): hospital-scoped create.
- **Consultation service** (`consultation-service.recordConsultation`): authorizes
  (`consultation.create`), verifies the encounter, records the consultation (records the
  acting user as `performedBy`, status `finalized`), audits `consultation.create`.
  Minimal per 05 §4 — reason + free-text note/vitals/diagnosis/recommendation, no
  structured clinical entities.
- **UI**: consultation form within the encounter (`/encounters/[id]/consultation/nouvelle`)
  with the patient banner; motif prefilled from the encounter; the recorded consultation
  appears in the encounter view.

## Verified
Service: Dr ETOA recorded a finalized consultation; reception was **denied**
(`authz.denied`). Audit chain: …encounter.create → consultation.create → authz.denied.
build/lint/typecheck ✓.
