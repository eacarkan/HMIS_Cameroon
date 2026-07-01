import { prisma } from "./prisma";
import { accrueEmergencyDebtWithinTx } from "./emergency";

/** Phase 2D-5 — dispense-record data-access (hospital-scoped, integer quantities). */

export type CreateDispenseRecordData = {
  hospitalId: string;
  dispenseNumber: string;
  prescriptionId: string;
  dispensedById: string;
  items: {
    prescriptionItemId: string;
    batchId: string;
    medicationLabel: string;
    unit: string;
    quantity: number;
  }[];
};

export function createDispenseRecordWithItems(data: CreateDispenseRecordData) {
  const { items, ...rest } = data;
  return prisma.dispenseRecord.create({
    data: { ...rest, items: { create: items.map((it) => ({ hospitalId: data.hospitalId, ...it })) } },
    include: { items: true },
  });
}

export function findDispenseRecordById(hospitalId: string, id: string) {
  return prisma.dispenseRecord.findFirst({
    where: { id, hospitalId },
    include: {
      items: { include: { batch: true } },
      dispensedBy: true,
      prescription: { include: { patient: true, prescribedBy: true } },
    },
  });
}

export function listDispenseRecordsForPrescription(hospitalId: string, prescriptionId: string) {
  return prisma.dispenseRecord.findMany({
    where: { hospitalId, prescriptionId },
    orderBy: { createdAt: "desc" },
    include: { items: true, dispensedBy: true },
  });
}

/**
 * Total quantity dispensed per prescription LINE across ALL dispense records of a prescription
 * (so the dispensed/partially-dispensed status is computed on the CUMULATIVE amount, not just the
 * current round). Returns a map prescriptionItemId → total dispensed.
 */
export async function sumDispensedByPrescriptionItem(hospitalId: string, prescriptionId: string) {
  const rows = await prisma.dispenseRecordItem.groupBy({
    by: ["prescriptionItemId"],
    where: { hospitalId, dispenseRecord: { prescriptionId } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.prescriptionItemId, r._sum.quantity ?? 0]));
}

export type DispenseLine = {
  prescriptionItemId: string;
  medicationLabel: string;
  unit: string;
  quantity: number; // the PRESCRIBED quantity (for the cumulative dispensed/partial status)
};

export type DispenseTxResult = {
  record: Awaited<ReturnType<typeof findDispenseRecordById>>;
  totalUnits: number;
  allFull: boolean;
  consumedCount: number;
  /** True only when the transaction confirmed the prescription was still unpaid and emergency-deferred. */
  emergencyDeferred: boolean;
  /** Set when an emergency-bypass debt was coupled in the SAME transaction (`created` false on reuse). */
  emergencyDebt: { id: string; created: boolean } | null;
};

/** Emergency-bypass debt to couple atomically with the dispense (Phase 3 QA patch). */
export type DispenseEmergencyDebt = {
  encounterId: string;
  patientId: string;
  amount: number;
  source: string;
  createdById?: string | null;
};

/**
 * Atomically dispense a prescription's active reservations (Phase 2D-5 — review hardening). The
 * WHOLE critical section runs inside one interactive `$transaction`, so a crash anywhere rolls back
 * the entire dispense (no half-deducted stock, no orphan record). Each reservation is CLAIMED with a
 * guarded `active → consumed` update: under a concurrent double-dispense (double-click / retry / two
 * pharmacists) the second transaction's claim matches 0 rows and that reservation is skipped — so a
 * reservation is consumed AT MOST ONCE and stock is never deducted twice. When the caller wins no
 * reservations (everything already dispensed), `record` is null and nothing is written.
 *
 * Stock deduction relies additionally on the DB-level non-negative CHECK constraints
 * (migration `…_stock_nonnegative_check`): a deduction that would drive on-hand/reserved below zero
 * aborts the transaction rather than corrupting the ledger.
 */
export async function dispenseReservationsForPrescription(params: {
  hospitalId: string;
  prescriptionId: string;
  dispensedById: string;
  dispenseNumber: string;
  lines: DispenseLine[];
  /** When set (emergency bypass), the placeholder debt is created in THIS transaction, idempotent by source. */
  emergencyDebt?: DispenseEmergencyDebt | null;
}): Promise<DispenseTxResult> {
  const { hospitalId, prescriptionId, dispensedById, dispenseNumber, lines } = params;

  const result = await prisma.$transaction(async (tx) => {
    const dispenseItems: {
      prescriptionItemId: string;
      batchId: string;
      medicationLabel: string;
      unit: string;
      quantity: number;
    }[] = [];
    let totalUnits = 0;

    for (const line of lines) {
      const reservations = await tx.stockReservation.findMany({
        where: { hospitalId, prescriptionItemId: line.prescriptionItemId, status: "active" },
        orderBy: [{ batch: { expiryDate: "asc" } }, { createdAt: "asc" }],
      });
      for (const r of reservations) {
        // Claim the reservation atomically; only the transaction that flips active→consumed deducts.
        const claim = await tx.stockReservation.updateMany({
          where: { id: r.id, hospitalId, status: "active" },
          data: { status: "consumed", consumedAt: new Date() },
        });
        if (claim.count === 0) continue; // a concurrent dispense already consumed it
        // Guarded decrement: only deduct when on-hand AND reserved cover the quantity, so a batch can
        // NEVER be driven negative (defends against any future over-deduction / inconsistent adjustment).
        // A guard miss aborts the whole transaction (rolling back the claim above).
        const dec = await tx.medicationStockBatch.updateMany({
          where: {
            id: r.batchId,
            hospitalId,
            quantityOnHand: { gte: r.quantity },
            quantityReserved: { gte: r.quantity },
          },
          data: {
            quantityOnHand: { decrement: r.quantity },
            quantityReserved: { decrement: r.quantity },
          },
        });
        if (dec.count === 0) {
          throw new Error("Stock insuffisant pour la délivrance (incohérence de stock détectée).");
        }
        dispenseItems.push({
          prescriptionItemId: line.prescriptionItemId,
          batchId: r.batchId,
          medicationLabel: line.medicationLabel,
          unit: line.unit,
          quantity: r.quantity,
        });
        totalUnits += r.quantity;
      }
    }

    if (dispenseItems.length === 0) {
      // Nothing dispensed (a concurrent dispense won every reservation) → accrue NO debt.
      return {
        recordId: null as string | null,
        totalUnits: 0,
        allFull: false,
        consumedCount: 0,
        emergencyDeferred: false,
        emergencyDebt: null as { id: string; created: boolean } | null,
      };
    }

    const record = await tx.dispenseRecord.create({
      data: {
        hospitalId,
        dispenseNumber,
        prescriptionId,
        dispensedById,
        items: { create: dispenseItems.map((it) => ({ hospitalId, ...it })) },
      },
    });

    // Cumulative dispensed per line, computed INSIDE the transaction (consistent with this round).
    const grouped = await tx.dispenseRecordItem.groupBy({
      by: ["prescriptionItemId"],
      where: { hospitalId, dispenseRecord: { prescriptionId } },
      _sum: { quantity: true },
    });
    const dispensedByItem = new Map(grouped.map((g) => [g.prescriptionItemId, g._sum.quantity ?? 0]));
    const allFull = lines.every((l) => (dispensedByItem.get(l.prescriptionItemId) ?? 0) >= l.quantity);
    await tx.prescription.updateMany({
      where: { id: prescriptionId, hospitalId },
      data: { status: allFull ? "dispensed" : "partially_dispensed" },
    });

    // Phase 3 QA patch: fold the emergency-bypass debt into THIS transaction so the dispense and the
    // debt commit-or-fail together. It runs only AFTER a real dispense record exists (a no-op dispense
    // accrues nothing); if the encounter is no longer an emergency the accrual THROWS and the whole
    // dispense rolls back (no service delivered without a coupled debt). Idempotent per source, so a
    // retry or a later partial round reuses the existing placeholder instead of duplicating it.
    let emergencyDeferred = false;
    let emergencyDebt: { id: string; created: boolean } | null = null;
    if (params.emergencyDebt) {
      // Re-derive emergency eligibility UNDER the (just-updated, row-locked) prescription: if it was
      // paid concurrently between the service's pre-tx read and now, accrue NO placeholder on a paid
      // prescription. The status updateMany above holds the row lock, so this read is authoritative.
      const presc = await tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId } });
      if (!presc.isPaid) {
        emergencyDeferred = true;
        const { debt, created } = await accrueEmergencyDebtWithinTx(
          tx,
          { hospitalId, ...params.emergencyDebt },
          { idempotentBySource: true },
        );
        emergencyDebt = { id: debt.id, created };
      }
    }

    return {
      recordId: record.id,
      totalUnits,
      allFull,
      consumedCount: dispenseItems.length,
      emergencyDeferred,
      emergencyDebt,
    };
  });

  const record = result.recordId ? await findDispenseRecordById(hospitalId, result.recordId) : null;
  return {
    record,
    totalUnits: result.totalUnits,
    allFull: result.allFull,
    consumedCount: result.consumedCount,
    emergencyDeferred: result.emergencyDeferred,
    emergencyDebt: result.emergencyDebt,
  };
}
