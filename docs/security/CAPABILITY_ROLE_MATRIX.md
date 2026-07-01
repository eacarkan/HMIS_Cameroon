# Capability ↔ Role matrix (Phase 5G — app-level access review)

**Synthetic prototype · not Gate 7 · app-level review only (not an external cybersecurity audit).**

Generated from `lib/rbac` (10 roles, 90 capabilities). Regenerate with `npm run docs:capability-matrix`. Server-side RBAC (`requireCapability` / `canAtHospital`) is authoritative; UI hiding is not security.

## Security invariants (verified — see `tests/unit/rbac-matrix-5g.test.ts`)
- **Single cross-hospital capability.** `central.aggregate.view` is the ONLY capability held across hospitals, and ONLY by `superviseur_central`. Central oversight is aggregate-only / snapshot-fed (Phase 3D).
- **No clinical/reception over-grant.** None of {medecin, agent_accueil, technicien_diagnostic, validateur_diagnostic, pharmacien, pharmacien_chef} holds any privileged manage/admin capability.
- **No live external calls / no real credentials by default.** Integration + MPI live flags default OFF; adapters are mock-only; credential references only.

## Privileged capabilities → holders

| Capability | Held by |
|---|---|
| `admin.manage` | administrateur |
| `user.manage` | administrateur |
| `config.manage` | administrateur |
| `config.template.manage` | administrateur |
| `config.instance.manage` | administrateur |
| `integration.system.manage` | administrateur |
| `integration.job.retry` | administrateur |
| `dhis2.mapping.manage` | administrateur |
| `dhis2.export.run` | administrateur |
| `external_result.import` | administrateur |
| `external_payment.reconcile` | caissier |
| `payer.manage` | administrateur |
| `claim.manage` | administrateur, caissier |
| `analytics.report.manage` | administrateur |
| `patient_match.review` | administrateur |
| `patient_match.configure` | administrateur |

## Per-role capabilities

### `administrateur` (50)
`admin.manage` · `admission.read` · `analytics.report.manage` · `analytics.report.view` · `audit.read` · `cashier.report.read` · `claim.manage` · `config.instance.manage` · `config.manage` · `config.read` · `config.template.manage` · `config.view` · `consultation.read` · `dashboard.read` · `dhis2.export.run` · `dhis2.mapping.manage` · `diagnostic.catalogue.manage` · `diagnostic.read` · `dispense.read` · `emergency.debt.read` · `encounter.read` · `external_payment.view` · `external_result.import` · `integration.job.retry` · `integration.job.view` · `integration.system.manage` · `invoice.cancel.approve` · `invoice.read` · `medication.manage` · `medication.view` · `patient.read` · `patient_match.configure` · `patient_match.review` · `payer.manage` · `prescription.read` · `queue.read` · `readiness.manage` · `readiness.view` · `refund.read` · `report.export` · `report.operational.read` · `reservation.release` · `service.config.manage` · `service.config.view` · `stock.read` · `tariff.manage` · `tariff.read` · `uat.manage` · `uat.view` · `user.manage`

### `agent_accueil` (17)
`admission.assign` · `admission.fee.charge` · `admission.read` · `dashboard.read` · `emergency.debt.read` · `emergency.flag` · `encounter.create` · `encounter.read` · `patient.create` · `patient.duplicate.manage` · `patient.identity.manage` · `patient.identity.read` · `patient.read` · `queue.manage` · `queue.read` · `queue.urgent` · `service.config.view`

### `caissier` (28)
`admission.fee.charge` · `admission.read` · `cashier.report.read` · `cashier.shift.manage` · `claim.manage` · `dashboard.read` · `diagnostic.payment.confirm` · `diagnostic.read` · `emergency.debt.accrue` · `emergency.debt.read` · `emergency.debt.settle` · `encounter.read` · `external_payment.reconcile` · `external_payment.view` · `invoice.cancel.request` · `invoice.create` · `invoice.read` · `patient.read` · `payment.record` · `prescription.payment.confirm` · `prescription.read` · `queue.read` · `receipt.print` · `refund.execute` · `refund.read` · `service.config.view` · `tariff.read` · `tariff.use`

### `directeur` (27)
`admission.read` · `analytics.report.view` · `audit.read` · `cashier.report.read` · `config.read` · `config.view` · `consultation.read` · `dashboard.read` · `diagnostic.read` · `dispense.read` · `emergency.debt.read` · `emergency.debt.waive` · `encounter.read` · `external_payment.view` · `integration.job.view` · `invoice.read` · `medication.view` · `patient.read` · `prescription.read` · `queue.read` · `readiness.view` · `refund.read` · `report.operational.read` · `service.config.view` · `stock.read` · `uat.signoff_placeholder` · `uat.view`

### `medecin` (22)
`admission.discharge` · `admission.read` · `admission.request` · `clinical.structure.manage` · `clinical.structure.read` · `consultation.create` · `consultation.read` · `dashboard.read` · `diagnostic.read` · `diagnostic.request` · `emergency.debt.read` · `emergency.flag` · `encounter.read` · `medication.view` · `patient.identity.read` · `patient.read` · `prescription.create` · `prescription.read` · `queue.manage` · `queue.read` · `queue.urgent` · `service.config.view`

### `pharmacien` (14)
`dashboard.read` · `dispense.perform` · `dispense.read` · `encounter.read` · `medication.view` · `patient.read` · `prescription.read` · `queue.manage` · `queue.read` · `reservation.release` · `service.config.view` · `stock.adjustment.request` · `stock.read` · `stock.receive`

### `pharmacien_chef` (15)
`dashboard.read` · `dispense.perform` · `dispense.read` · `encounter.read` · `fefo.override` · `medication.view` · `patient.read` · `prescription.read` · `queue.manage` · `queue.read` · `reservation.release` · `service.config.view` · `stock.adjustment.approve` · `stock.read` · `stock.receive`

### `superviseur_central` (4)
`central.aggregate.view` · `dashboard.read` · `readiness.view` · `uat.view`

### `technicien_diagnostic` (6)
`dashboard.read` · `diagnostic.read` · `diagnostic.result.enter` · `encounter.read` · `external_result.review` · `patient.read`

### `validateur_diagnostic` (5)
`dashboard.read` · `diagnostic.read` · `diagnostic.validate` · `encounter.read` · `patient.read`

