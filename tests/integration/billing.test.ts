import { beforeEach, describe, expect, it } from "vitest";

import { TARIFFS } from "@/lib/constants";
import { todayIsoDate } from "@/lib/dates";
import { AuthorizationError } from "@/server/authz";
import {
  closeCashierShift,
  createInvoice,
  createPatientForActor,
  exportCashierDailyReportCsv,
  getCashierDailyReport,
  getInvoice,
  invoiceBalance,
  openEncounter,
  recordPayment,
  voidInvoice,
} from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const LINES = [
  { label: "Consultation médecine générale", unitAmount: 2000, quantity: 1 },
  { label: "Frais d'ouverture de dossier", unitAmount: 1000, quantity: 1 },
];

async function anEncounterId() {
  const reception = await loginAndSelect(ACCOUNTS.reception);
  const patient = await createPatientForActor(reception.actor, reception.ctx, {
    familyName: "BELLO",
    givenName: "Aïssatou",
    sex: "female",
    dateOfBirth: new Date("1990-03-14"),
    phone: null,
    residence: null,
  });
  const encounter = await openEncounter(
    reception.actor,
    reception.ctx,
    patient.id,
    {
      serviceLabel: "Médecine générale",
      reason: "Fièvre",
    },
  );
  return encounter.id;
}

describe("integration: billing / payment (06 §12, 07 §8)", () => {
  beforeEach(resetTestDb);

  it("invoice mints HRB-DEMO-F-2026-000001; total = Σ line items = 3 000", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(
      cashier.actor,
      cashier.ctx,
      encounterId,
      LINES,
    );

    expect(invoice.invoiceNumber).toBe("HRB-DEMO-F-2026-000001");
    expect(invoice.status).toBe("issued");
    expect(invoice.totalAmount).toBe(3000);
    const sumItems = invoice.items.reduce((s, i) => s + i.lineTotal, 0);
    expect(sumItems).toBe(3000);
    // Line items use the fake tariff catalogue amounts.
    expect(invoice.items.map((i) => i.unitAmount).sort()).toEqual([1000, 2000]);
    expect(TARIFFS.some((t) => t.amount === 2000)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "invoice.create" },
    });
    expect(audit?.summary).toContain("HRB-DEMO-F-2026-000001");
  });

  it("full payment mints HRB-DEMO-R-2026-000001 and sets status Payée; reconciles", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(
      cashier.actor,
      cashier.ctx,
      encounterId,
      LINES,
    );
    const payment = await recordPayment(
      cashier.actor,
      cashier.ctx,
      invoice.id,
      {
        amount: invoice.totalAmount,
        method: "cash",
      },
    );
    expect(payment.receiptNumber).toBe("HRB-DEMO-R-2026-000001");

    const full = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    const { paid, remaining } = invoiceBalance(full!);
    expect(full!.status).toBe("paid");
    expect(paid).toBe(3000);
    expect(remaining).toBe(0);
    expect(payment.amount).toBe(full!.totalAmount);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "payment.record" },
    });
    expect(audit?.summary).toContain("espèces");
  });

  it("rejects a payment exceeding the remaining balance", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(
      cashier.actor,
      cashier.ctx,
      encounterId,
      LINES,
    );
    await expect(
      recordPayment(cashier.actor, cashier.ctx, invoice.id, {
        amount: 5000,
        method: "cash",
      }),
    ).rejects.toThrow();
  });

  it("handles partial payment → partially_paid → paid", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(
      cashier.actor,
      cashier.ctx,
      encounterId,
      LINES,
    );

    await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
      amount: 1000,
      method: "cash",
    });
    let full = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(full!.status).toBe("partially_paid");
    expect(invoiceBalance(full!).remaining).toBe(2000);

    await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
      amount: 2000,
      method: "cash",
    });
    full = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(full!.status).toBe("paid");
    expect(invoiceBalance(full!).remaining).toBe(0);
  });

  it("reception cannot create an invoice or record a payment (server-side)", async () => {
    const encounterId = await anEncounterId();
    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(
      createInvoice(reception.actor, reception.ctx, encounterId, LINES),
    ).rejects.toBeInstanceOf(AuthorizationError);

    // create the invoice as cashier, then reception attempts to pay
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(
      cashier.actor,
      cashier.ctx,
      encounterId,
      LINES,
    );
    await expect(
      recordPayment(reception.actor, reception.ctx, invoice.id, {
        amount: 3000,
        method: "cash",
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

describe("integration: Phase 1A Batch 3 — billing/cashier controls", () => {
  beforeEach(resetTestDb);

  async function paidInvoice() {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, LINES);
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, {
      amount: invoice.totalAmount,
      method: "cash",
    });
    return { cashier, invoice };
  }

  it("voids an invoice with reason: status cancelled, payments cancelled, items immutable, audited", async () => {
    const { cashier, invoice } = await paidInvoice();
    const before = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    const itemsBefore = before!.items.map((i) => ({ label: i.label, lineTotal: i.lineTotal }));

    await voidInvoice(cashier.actor, cashier.ctx, invoice.id, "Erreur de saisie");

    const after = await getInvoice(cashier.actor, cashier.ctx, invoice.id);
    expect(after!.status).toBe("cancelled");
    expect(after!.payments.every((p) => p.status === "cancelled")).toBe(true);
    // InvoiceItem snapshots are unchanged (no rewrite of history).
    expect(after!.items.map((i) => ({ label: i.label, lineTotal: i.lineTotal }))).toEqual(itemsBefore);

    const audit = await prisma.auditLog.findFirst({ where: { action: "invoice.void", entityId: invoice.id } });
    expect(audit?.summary).toContain("Erreur de saisie");
  });

  it("rejects voiding an already-cancelled invoice", async () => {
    const { cashier, invoice } = await paidInvoice();
    await voidInvoice(cashier.actor, cashier.ctx, invoice.id, "Doublon");
    await expect(
      voidInvoice(cashier.actor, cashier.ctx, invoice.id, "Encore"),
    ).rejects.toThrow(/déjà annulée/);
  });

  it("voided payments are excluded from the cashier daily report", async () => {
    const { cashier, invoice } = await paidInvoice();
    const today = todayIsoDate();
    const before = await getCashierDailyReport(cashier.actor, cashier.ctx, today);
    expect(before.total).toBe(3000);
    await voidInvoice(cashier.actor, cashier.ctx, invoice.id, "Annulation test");
    const after = await getCashierDailyReport(cashier.actor, cashier.ctx, today);
    expect(after.total).toBe(0);
    expect(after.count).toBe(0);
  });

  it("daily report filters by payment method and aggregates totals by mode", async () => {
    const encounterId = await anEncounterId();
    const cashier = await loginAndSelect(ACCOUNTS.cashier);
    const invoice = await createInvoice(cashier.actor, cashier.ctx, encounterId, LINES); // 3000
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 2000, method: "cash" });
    await recordPayment(cashier.actor, cashier.ctx, invoice.id, { amount: 1000, method: "mobile_money" });
    const today = todayIsoDate();

    const all = await getCashierDailyReport(cashier.actor, cashier.ctx, { date: today });
    expect(all.total).toBe(3000);
    expect(all.byMethod.map((m) => [m.method, m.total])).toEqual([
      ["cash", 2000],
      ["mobile_money", 1000],
    ]);

    const cashOnly = await getCashierDailyReport(cashier.actor, cashier.ctx, { date: today, method: "cash" });
    expect(cashOnly.count).toBe(1);
    expect(cashOnly.total).toBe(2000);
  });

  it("closing a shift computes totals by mode and is audited", async () => {
    const { cashier } = await paidInvoice();
    const summary = await closeCashierShift(cashier.actor, cashier.ctx, todayIsoDate());
    expect(summary.total).toBe(3000);
    expect(summary.byMethod[0]).toMatchObject({ method: "cash", total: 3000 });
    const audit = await prisma.auditLog.findFirst({ where: { action: "cashier.shift_close" } });
    expect(audit?.summary).toContain("Clôture de caisse");
  });

  it("CSV export is BOM-prefixed and reflects the report", async () => {
    const { cashier } = await paidInvoice();
    const { csv } = await exportCashierDailyReportCsv(cashier.actor, cashier.ctx, todayIsoDate());
    expect(csv.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM for spreadsheets
    expect(csv).toContain("HRB-DEMO-R-2026-000001");
    expect(csv).toContain("3000");
  });
});
