# Known issues — `v0.5.0-rc.1` (synthetic)

**No critical blocker.** (Critical = data loss, financial calculation error, access-control leak, cross-hospital leakage, or missing audit on a critical workflow.)

| # | Severity | Item | Status |
|---|---|---|---|
| 1 | Non-blocking (library) | A single per-process `pg` `client.query()` deprecation warning can appear in some test/e2e `[WebServer]` logs. Its stack has **no application frame** — it originates in the `@prisma/adapter-pg` / `pg` driver during interactive transactions. The one application-level cause (parallel `tx.*` reads in the config-template transaction) was fixed in Phase 5D. Removing the residual needs a `pg`/driver upgrade. | Documented (5D); non-blocking |
| 2 | By-design | External integrations (DHIS2, payment provider, insurer, lab import, MPI) are **mock/sandbox only** — no live connector ships. This is the intended Phase 4/4G boundary, not a defect. | Intended |
| 3 | By-design | Scheduled analytics runs and central aggregate snapshots are **on-demand placeholders** (no background scheduler). | Intended |

## Not applicable to this RC (out of scope by design)
Production deployment · real patient data · Gate 7 authorization · hardware/network/cyber validation · live external integrations · source-code transfer. These are administrative/authorization items outside software scope.
