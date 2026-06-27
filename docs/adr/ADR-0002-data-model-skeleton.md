# ADR-0002 — Walking-skeleton data model + demo seed (Step 3)

**Status:** Accepted · **Date:** 2026-06-27 · **Scope:** build sequence Step 3 — fake
demo data concept (HRB-DEMO, users, deterministic IDs), per `09 §14`.

Implements the first walking-skeleton subset of `05_Logical_Data_Model_v0 §4`. Records
the schema-level choices; the logical model (05) remains the source of truth.

---

## Entities (the skeleton subset)

`Hospital, Role, User, UserRole, Patient, Encounter, Consultation, Invoice,
InvoiceItem, Payment, AuditLog, Sequence` — plus the enums for status/type. Everything
else in 05 (Permission, Practitioner, PatientIdentifier/Contact, Diagnosis/Observation,
Tariff/PriceList, Department/ServiceUnit, lab, pharmacy, DocumentTemplate/Setting) is
deliberately **not** modelled yet.

## Decisions

1. **Hospital scoping (D-011).** Every operational record carries `hospitalId` with a
   relation to `Hospital`. Human-readable numbers are unique per hospital
   (`@@unique([hospitalId, <number>])`). `AuditLog.hospitalId` is **nullable** so
   pre-selection events (e.g. `auth.login`) can still be recorded.
2. **Integer FCFA (D-009).** `Invoice.totalAmount`, `InvoiceItem.unitAmount/lineTotal`,
   `Payment.amount` are all `Int`. No floats, no decimals.
3. **Status as neutral codes (05 §5).** Prisma enums (`EncounterStatus`,
   `ConsultationStatus`, `InvoiceStatus`, `PaymentStatus`, `Sex`, `PaymentMethod`,
   `SequenceType`, `UserStatus`); French labels live in the UI, never in the DB.
4. **Soft delete (05 §2).** `deletedAt` on Patient/Encounter/Consultation/Invoice/
   Payment; `AuditLog` is append-only (only `createdAt`, no soft delete).
5. **Numbering (05 §6).** A `Sequence(hospitalId, type, year, current)` counter backs
   the human-readable numbers; the pure format lives in `lib/numbering`
   (`HRB-DEMO-P-2026-000001`). The transaction-safe increment is wired at Step 6 when
   the first number is generated for real.
6. **Minimal RBAC (05 §4).** `UserRole(user, role, hospital)` only; no Permission
   matrix. Role codes match the `Role` union already stubbed in `server/authz`.
7. **`User.passwordHash` now, verification later.** The column and a bcrypt hash of the
   shared demo password are seeded now (data); Auth.js credential verification is Step 4.
8. **Consultation free-text fields.** `reason` + optional `clinicalNote`, `vitals`,
   `provisionalDiagnosis`, `recommendation` — plain text columns, **not** structured
   clinical entities (05 §4 keeps consultation minimal). They let the Step 8 form carry
   the demo content without introducing Diagnosis/Observation entities.

## Migrations & seed

- Migration `…_init_skeleton_models` created via `prisma migrate dev` (the `hmis` role
  has `CREATEDB` for the shadow DB). `prisma.config.ts` wires `migrations.seed`.
- The seed (`prisma/seed-data.ts` → `scripts/seed.ts`) is **idempotent** (upsert on
  deterministic ids) and establishes the known starting state (07 §14): 8 hospitals
  (HRB-DEMO active+demo, 7 inactive), 5 roles, 5 users + role assignments @ HRB-DEMO,
  and zeroed 2026 sequences. **No** patient/encounter/invoice — those are created live
  during the demo (Steps 6-9). Reset clears operational data + re-seeds.
- All data is fake (A-001/D-008). Demo login password (all users): `demo1234`.
