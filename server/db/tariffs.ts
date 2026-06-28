import { prisma } from "./prisma";

/**
 * Tariff / price-list access — hospital-scoped (Phase 1, Gate 2). Integer FCFA only.
 * These are a configurable SOURCE for billing; InvoiceItem keeps its own historical
 * snapshot, so changes here never alter past invoices/receipts. Minimal by design.
 */

export function listPriceLists(hospitalId: string) {
  return prisma.priceList.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { code: "asc" },
  });
}

export function listTariffs(hospitalId: string) {
  return prisma.tariff.findMany({
    where: { hospitalId, deletedAt: null },
    orderBy: { code: "asc" },
  });
}

export function findTariffByCode(hospitalId: string, code: string) {
  return prisma.tariff.findFirst({
    where: { hospitalId, code, deletedAt: null },
  });
}
