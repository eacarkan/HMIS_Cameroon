import type { StockAdjustmentStatus, StockAdjustmentType } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2D-7 — stock-adjustment data-access (hospital-scoped, integer quantities, dual validation). */

export type CreateStockAdjustmentData = {
  hospitalId: string;
  batchId: string;
  medicationId: string;
  type: StockAdjustmentType;
  quantity: number;
  reason: string;
  requestedById: string;
};

const detailInclude = {
  batch: { include: { medication: true } },
  medication: true,
  requestedBy: true,
  decidedBy: true,
} as const;

export function createStockAdjustment(data: CreateStockAdjustmentData) {
  return prisma.stockAdjustment.create({ data, include: detailInclude });
}

export function findStockAdjustmentById(hospitalId: string, id: string) {
  return prisma.stockAdjustment.findFirst({ where: { id, hospitalId }, include: detailInclude });
}

export function listStockAdjustments(hospitalId: string, status?: StockAdjustmentStatus) {
  return prisma.stockAdjustment.findMany({
    where: { hospitalId, ...(status ? { status } : {}) },
    include: detailInclude,
    orderBy: { createdAt: "desc" },
  });
}

/** Reject a requested adjustment (no stock change). Guarded on `requested` to prevent a double decision. */
export async function rejectStockAdjustmentRow(params: {
  hospitalId: string;
  adjustmentId: string;
  decidedById: string;
  decisionReason: string;
}) {
  const res = await prisma.stockAdjustment.updateMany({
    where: { id: params.adjustmentId, hospitalId: params.hospitalId, status: "requested" },
    data: {
      status: "rejected",
      decidedById: params.decidedById,
      decisionReason: params.decisionReason,
      decidedAt: new Date(),
    },
  });
  if (res.count === 0) throw new Error("Cet ajustement a déjà été traité.");
  return findStockAdjustmentById(params.hospitalId, params.adjustmentId);
}

/**
 * Approve a requested adjustment and apply the on-hand change ATOMICALLY (Phase 2D-7). One
 * `$transaction`: claim the adjustment (status requested → approved, guarded so a double-approve loses),
 * then mutate the batch. An `increase` adds to on-hand; a reducing adjustment first checks the
 * AVAILABLE (on-hand − reserved) covers the quantity — reserved units are protected — then decrements
 * with an optimistic guard (on-hand unchanged since read). The DB CHECK (on-hand ≥ 0) is the backstop.
 */
export async function approveStockAdjustmentTx(params: {
  hospitalId: string;
  adjustmentId: string;
  batchId: string;
  type: StockAdjustmentType;
  quantity: number;
  decidedById: string;
  decisionReason: string | null;
}) {
  const { hospitalId, adjustmentId, batchId, type, quantity, decidedById, decisionReason } = params;

  return prisma.$transaction(async (tx) => {
    const claim = await tx.stockAdjustment.updateMany({
      where: { id: adjustmentId, hospitalId, status: "requested" },
      data: { status: "approved", decidedById, decisionReason, decidedAt: new Date() },
    });
    if (claim.count === 0) throw new Error("Cet ajustement a déjà été traité.");

    const batch = await tx.medicationStockBatch.findFirst({ where: { id: batchId, hospitalId } });
    if (!batch) throw new Error("Lot introuvable dans cet hôpital.");

    if (type === "increase") {
      const inc = await tx.medicationStockBatch.updateMany({
        where: { id: batchId, hospitalId, quantityOnHand: batch.quantityOnHand },
        data: { quantityOnHand: { increment: quantity } },
      });
      if (inc.count === 0) throw new Error("Le stock a changé — veuillez réessayer l'ajustement.");
    } else {
      const available = batch.quantityOnHand - batch.quantityReserved;
      if (available < quantity) {
        throw new Error(
          "Stock disponible insuffisant pour cet ajustement (les unités réservées sont protégées).",
        );
      }
      // Pin BOTH on-hand AND reserved to the values the AVAILABLE check validated. If a concurrent
      // reservation/dispense changed either since the read, this matches 0 rows and the transaction
      // aborts — so the decrement can never run against a stale `reserved` and drive on-hand below it.
      const dec = await tx.medicationStockBatch.updateMany({
        where: {
          id: batchId,
          hospitalId,
          quantityOnHand: batch.quantityOnHand,
          quantityReserved: batch.quantityReserved,
        },
        data: { quantityOnHand: { decrement: quantity } },
      });
      if (dec.count === 0) throw new Error("Le stock a changé — veuillez réessayer l'ajustement.");
    }

    return tx.stockAdjustment.findFirst({ where: { id: adjustmentId, hospitalId }, include: detailInclude });
  });
}
