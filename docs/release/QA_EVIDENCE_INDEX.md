# QA evidence index — `v0.5.0-rc.1` (synthetic)

Maps each phase/batch to its committed QA transcripts. The authoritative current-HEAD totals are the **highest Phase 5 batch** folder. See `docs/qa-command-output/README.md` for provenance.

| Phase / batch | Evidence folder | Implementation log |
|---|---|---|
| Phase 3 (final tip) | `docs/qa-command-output/` (root `*.txt`) + `3A…3E/`, `3P-1/`, `3P-2/` | `docs/phase3-implementation-logs/` |
| Phase 4A–4F (accepted) | `docs/qa-command-output/phase4/4A…4F/`, `phase4/FINAL/` | `docs/phase4-implementation-logs/` |
| Phase 4G | `docs/qa-command-output/phase4/4G/` | `docs/phase4g-implementation-logs/` |
| Phase 5A — QA hygiene | `docs/qa-command-output/phase5/5A/` | `docs/phase5-implementation-logs/5A_qa-hygiene.md` |
| Phase 5G — security/access review | `docs/qa-command-output/phase5/5G/` | `docs/phase5-implementation-logs/5G_security-access-review.md` |
| Phase 5B — UX/role dashboards | `docs/qa-command-output/phase5/5B/` | `docs/phase5-implementation-logs/5B_ux-role-dashboards.md` |
| Phase 5C — UAT/data factory | `docs/qa-command-output/phase5/5C/` | `docs/phase5-implementation-logs/5C_uat-data-factory.md` |
| Phase 5D — performance | `docs/qa-command-output/phase5/5D/` | `docs/phase5-implementation-logs/5D_performance-query-hardening.md` |
| Phase 5E — validation/i18n | `docs/qa-command-output/phase5/5E/` | `docs/phase5-implementation-logs/5E_validation-error-i18n.md` |
| Phase 5F — RC packaging | `docs/qa-command-output/phase5/5F/` | `docs/phase5-implementation-logs/5F_release-packaging.md` |
| Phase 5H — pilot readiness | `docs/qa-command-output/phase5/5H/` | `docs/phase5-implementation-logs/5H_pilot-readiness.md` |

Each batch folder holds the §8 block transcripts (`typecheck / lint / test / test-integration / build / smoke / check-arch / check-privacy / check-i18n / test-e2e`). `scripts/check-release.ts` verifies these folders exist and that the version marker is synthetic.
