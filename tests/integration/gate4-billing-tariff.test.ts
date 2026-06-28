import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db";
import {
  createPatientForActor,
  openEncounter,
  createInvoice,
  getTariffLineSource,
  deactivateTariff,
  updateTariff,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { resetTestDb } from "../helpers/db";

const HRB = "hosp-hrb-demo";

/**
 * Gate 4 billing — DB-driven tariff source. Confirms invoice lines come from the DB
 * tariff catalogue (audited), the InvoiceItem snapshot is frozen, and a missing/inactive
 * tariff REJECTS (the action returns a French error) rather than silently falling back to
 * the static constants. Fake data only.
 */
describe("integration: Gate 4 billing tariff source (DB-driven, no fallback)", () => {
  beforeEach(resetTestDb);

  it("invoice lines are sourced from the DB tariff and snapshot-frozen (audited)", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(rec, rctx, {
      familyName: "BILL",
      givenName: "Test",
      sex: "female",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(rec, rctx, patient.id, {
      serviceLabel: "Médecine générale",
      reason: "t",
    });

    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    const line = await getTariffLineSource(cai, cctx, "consultation_generale"); // 2 000 from DB
    expect(line).toMatchObject({
      label: "Consultation médecine générale",
      unitAmount: 2000,
      quantity: 1,
    });

    const invoice = await createInvoice(cai, cctx, enc.id, [line]);
    const item = await prisma.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(item.label).toBe("Consultation médecine générale");
    expect(item.unitAmount).toBe(2000);
    expect(item.lineTotal).toBe(2000);
    expect(await prisma.auditLog.count({ where: { action: "invoice_item.tariff_source_used" } })).toBeGreaterThanOrEqual(1);
  });

  it("a DEACTIVATED tariff cannot be used as a source — rejects (no static fallback)", async () => {
    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { hospitalId: HRB, code: "pansement" } });
    await deactivateTariff(adm, actx, tariff.id);

    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    await expect(getTariffLineSource(cai, cctx, "pansement")).rejects.toThrow();
  });

  it("an unknown tariff code rejects — no fallback to the static catalogue", async () => {
    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    await expect(getTariffLineSource(cai, cctx, "code_inexistant")).rejects.toThrow();
  });

  it("snapshot is unaffected by a later tariff change", async () => {
    const { actor: rec, ctx: rctx } = await loginAndSelect(ACCOUNTS.reception);
    const patient = await createPatientForActor(rec, rctx, {
      familyName: "SNAP2",
      givenName: "Test",
      sex: "male",
      dateOfBirth: new Date("1990-01-01"),
      phone: null,
      residence: null,
    });
    const enc = await openEncounter(rec, rctx, patient.id, { serviceLabel: "Médecine générale", reason: "t" });
    const { actor: cai, ctx: cctx } = await loginAndSelect(ACCOUNTS.cashier);
    const line = await getTariffLineSource(cai, cctx, "ouverture_dossier"); // 1 000
    const invoice = await createInvoice(cai, cctx, enc.id, [line]);

    const { actor: adm, ctx: actx } = await loginAndSelect(ACCOUNTS.admin);
    const tariff = await prisma.tariff.findFirstOrThrow({ where: { hospitalId: HRB, code: "ouverture_dossier" } });
    await updateTariff(adm, actx, tariff.id, { amount: 9999 });

    const item = await prisma.invoiceItem.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    expect(item.unitAmount).toBe(1000); // snapshot, not 9999
    expect(item.lineTotal).toBe(1000);
  });
});
