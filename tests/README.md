# tests

Unit tests (Vitest) on services and `lib`, plus one Playwright smoke on the golden
path (added later per ADR-0 / 09 §11). First quality targets: golden-path smoke,
a blocked-authorization test, money-total reconciliation, audit-entry presence,
receipt/invoice consistency. **No production data** in any test or fixture.

_Empty in the foundation (Steps 1-2); test code is added alongside the features it
covers._
