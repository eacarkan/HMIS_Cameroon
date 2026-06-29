import { beforeEach, describe, expect, it } from "vitest";

import { AuthorizationError } from "@/server/authz";
import { getStockSummary, listStock, receiveStockBatch } from "@/server/services";
import { ACCOUNTS, loginAndSelect } from "../helpers/actors";
import { prisma, resetTestDb } from "../helpers/db";

const OTHER = "hosp-hrn-nga";

async function aMedId(hospitalId: string, code = "MED-PARA-500") {
  const med = await prisma.medication.findFirst({ where: { hospitalId, code } });
  return med!.id;
}

describe("integration: Phase 2D-3 — medication stock batches", () => {
  beforeEach(resetTestDb);

  it("seeds a synthetic stock ledger (Paracétamol has two lots)", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.pharmacist);
    const batches = await listStock(actor, ctx);
    expect(batches.length).toBeGreaterThanOrEqual(4);
    const para = batches.filter((b) => b.medication.code === "MED-PARA-500");
    expect(para.length).toBe(2);
  });

  it("pharmacist receives a batch (audited), increasing on-hand", async () => {
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const medId = await aMedId(pharm.ctx.hospitalId);
    const batch = await receiveStockBatch(pharm.actor, pharm.ctx, {
      medicationId: medId,
      batchNumber: "LOT-NEW-1",
      expiryDate: "2028-01-31",
      quantity: 250,
    });
    expect(batch.quantityOnHand).toBe(250);
    expect(batch.quantityReserved).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "stock.batch_received", entityId: batch.id },
    });
    expect(audit?.summary).toContain("LOT-NEW-1");
    expect(audit?.summary).toContain("250");
  });

  it("rejects an invalid batch (bad quantity / invalid expiry) and an inactive medication", async () => {
    const pharm = await loginAndSelect(ACCOUNTS.pharmacist);
    const medId = await aMedId(pharm.ctx.hospitalId);
    await expect(
      receiveStockBatch(pharm.actor, pharm.ctx, {
        medicationId: medId,
        batchNumber: "X",
        expiryDate: "2028-01-31",
        quantity: 0,
      }),
    ).rejects.toThrow(/quantité/);
    await expect(
      receiveStockBatch(pharm.actor, pharm.ctx, {
        medicationId: medId,
        batchNumber: "X",
        expiryDate: "bad",
        quantity: 5,
      }),
    ).rejects.toThrow(/péremption/);
    await expect(
      receiveStockBatch(pharm.actor, pharm.ctx, {
        medicationId: "no-such-med",
        batchNumber: "X",
        expiryDate: "2028-01-31",
        quantity: 5,
      }),
    ).rejects.toThrow(/introuvable ou inactif/);
  });

  it("stock summary aggregates on-hand / reserved per medication", async () => {
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.pharmacist);
    const summary = await getStockSummary(actor, ctx);
    const para = summary.find((s) => s.code === "MED-PARA-500");
    expect(para!.totalOnHand).toBe(700); // 200 + 500 seeded lots
    expect(para!.totalReserved).toBe(0);
    expect(para!.available).toBe(700);
    expect(para!.batchCount).toBe(2);
  });

  it("RBAC: admin reads but cannot receive; reception cannot read", async () => {
    const admin = await loginAndSelect(ACCOUNTS.admin);
    expect((await listStock(admin.actor, admin.ctx)).length).toBeGreaterThan(0);
    const medId = await aMedId(admin.ctx.hospitalId);
    await expect(
      receiveStockBatch(admin.actor, admin.ctx, {
        medicationId: medId,
        batchNumber: "X",
        expiryDate: "2028-01-31",
        quantity: 5,
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);

    const reception = await loginAndSelect(ACCOUNTS.reception);
    await expect(listStock(reception.actor, reception.ctx)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it("hospital scoping: a batch in ANOTHER hospital is not listed here", async () => {
    const otherMed = await prisma.medication.create({
      data: { hospitalId: OTHER, code: "MED-OTHER", nameFr: "Autre", nameEn: "Other", form: "Comprimé", unit: "comprimé" },
    });
    await prisma.medicationStockBatch.create({
      data: {
        hospitalId: OTHER,
        medicationId: otherMed.id,
        batchNumber: "LOT-OTHER",
        expiryDate: new Date("2028-01-31"),
        quantityReceived: 99,
        quantityOnHand: 99,
      },
    });
    const { actor, ctx } = await loginAndSelect(ACCOUNTS.pharmacist); // HRB
    const codes = (await listStock(actor, ctx)).map((b) => b.batchNumber);
    expect(codes).not.toContain("LOT-OTHER");
  });
});
