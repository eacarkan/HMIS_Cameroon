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

// --- Phase 1 (Gate 3) scoped lookups + mutations. Service layer enforces RBAC/audit. ---

export type CreatePriceListData = {
  hospitalId: string;
  code: string;
  name: string;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};
export function createPriceList(data: CreatePriceListData) {
  return prisma.priceList.create({ data });
}
export function findPriceListById(hospitalId: string, id: string) {
  return prisma.priceList.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updatePriceList(
  id: string,
  data: {
    name?: string;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    isActive?: boolean;
  },
) {
  return prisma.priceList.update({ where: { id }, data });
}

export type CreateTariffData = {
  hospitalId: string;
  priceListId?: string | null;
  code: string;
  label: string;
  amount: number; // integer FCFA
  // Phase 2C — optional effective dates (informational; never alter InvoiceItem snapshots).
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
};
export function createTariff(data: CreateTariffData) {
  return prisma.tariff.create({ data });
}
export function findTariffById(hospitalId: string, id: string) {
  return prisma.tariff.findFirst({ where: { id, hospitalId, deletedAt: null } });
}
export function updateTariff(
  id: string,
  data: {
    label?: string;
    amount?: number; // integer FCFA
    priceListId?: string | null;
    isActive?: boolean;
    // Phase 2C — optional effective dates.
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
  },
) {
  return prisma.tariff.update({ where: { id }, data });
}
