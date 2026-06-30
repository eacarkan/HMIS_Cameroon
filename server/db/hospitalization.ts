import type { AdmissionStatus } from "@prisma/client";

import { computeDischargeBlock } from "@/lib/hospitalization";
import { prisma } from "./prisma";

/**
 * Phase 2G — ward-level hospitalization data-access (hospital-scoped; integer FCFA). The mutating
 * transitions are guarded `updateMany` claims (so concurrent double-decisions lose), and the daily
 * ward fee accrual is one `$transaction` that is idempotent per day (the `AdmissionDailyCharge`
 * `@@unique[hospitalId, admissionId, chargeDate]` collapses a same-day re-charge).
 */

export type CreateAdmissionData = {
  hospitalId: string;
  encounterId: string;
  patientId: string;
  admissionNumber: string;
  reason: string;
  requestedById?: string | null;
};

const ADMISSION_INCLUDE = {
  patient: true,
  wardService: true,
  invoice: { include: { payments: true } },
  dailyCharges: { orderBy: { chargeDate: "asc" } },
} as const;

/**
 * Create an admission ATOMICALLY, enforcing "at most one active admission per encounter". One
 * `$transaction` locks the encounter row FIRST (a touch), then re-checks for a non-terminal admission
 * under that lock before creating — so two concurrent requests on the same encounter serialise and the
 * second is rejected (no double-admission).
 */
export async function createAdmissionTx(data: CreateAdmissionData) {
  return prisma.$transaction(async (tx) => {
    const enc = await tx.encounter.findFirst({
      where: { id: data.encounterId, hospitalId: data.hospitalId },
    });
    if (!enc) throw new Error("Visite introuvable dans cet hôpital.");
    // Take the encounter row's write lock (serialises concurrent requestAdmission on this encounter).
    await tx.encounter.update({ where: { id: data.encounterId }, data: { updatedAt: new Date() } });
    const active = await tx.admission.findFirst({
      where: {
        hospitalId: data.hospitalId,
        encounterId: data.encounterId,
        status: { in: ["requested", "admitted", "discharge_requested"] },
      },
    });
    if (active) throw new Error("Une hospitalisation est déjà en cours pour cette visite.");
    return tx.admission.create({
      data: {
        hospitalId: data.hospitalId,
        encounterId: data.encounterId,
        patientId: data.patientId,
        admissionNumber: data.admissionNumber,
        reason: data.reason,
        requestedById: data.requestedById ?? null,
      },
    });
  });
}

export function findAdmissionById(hospitalId: string, id: string) {
  return prisma.admission.findFirst({
    where: { id, hospitalId },
    include: ADMISSION_INCLUDE,
  });
}

/** The most recent admission on an encounter (any status), with full detail — for the encounter card. */
export function findLatestAdmissionForEncounter(hospitalId: string, encounterId: string) {
  return prisma.admission.findFirst({
    where: { hospitalId, encounterId },
    include: ADMISSION_INCLUDE,
    orderBy: { requestedAt: "desc" },
  });
}

/** The single non-terminal admission on an encounter (if any) — guards against opening a second one. */
export function findActiveAdmissionForEncounter(hospitalId: string, encounterId: string) {
  return prisma.admission.findFirst({
    where: {
      hospitalId,
      encounterId,
      status: { in: ["requested", "admitted", "discharge_requested"] },
    },
  });
}

export function listAdmissions(
  hospitalId: string,
  opts?: { statuses?: AdmissionStatus[] },
) {
  return prisma.admission.findMany({
    where: {
      hospitalId,
      ...(opts?.statuses ? { status: { in: opts.statuses } } : {}),
    },
    include: { patient: true, wardService: true },
    orderBy: { requestedAt: "desc" },
  });
}

/** Assign a ward (requested → admitted), snapshotting the daily ward fee. Guarded: only a still-
 *  `requested` admission transitions, so a concurrent second assignment loses. */
export async function assignWardTx(params: {
  hospitalId: string;
  id: string;
  wardServiceUnitId: string;
  dailyWardFee: number;
  dailyFeeTariffId: string | null;
  admittedById: string;
}) {
  const res = await prisma.admission.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "requested" },
    data: {
      status: "admitted",
      wardServiceUnitId: params.wardServiceUnitId,
      dailyWardFee: params.dailyWardFee,
      dailyFeeTariffId: params.dailyFeeTariffId,
      admittedById: params.admittedById,
      admittedAt: new Date(),
    },
  });
  if (res.count === 0) {
    throw new Error("Cette demande d'hospitalisation a déjà été traitée ou est introuvable.");
  }
  return findAdmissionById(params.hospitalId, params.id);
}

/** Cancel an admission before a ward is assigned (requested → cancelled). Guarded. */
export async function cancelAdmissionTx(params: {
  hospitalId: string;
  id: string;
  cancelledById: string;
  cancelReason: string;
}) {
  const res = await prisma.admission.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "requested" },
    data: {
      status: "cancelled",
      cancelledById: params.cancelledById,
      cancelReason: params.cancelReason,
      cancelledAt: new Date(),
    },
  });
  if (res.count === 0) {
    throw new Error("Seule une demande non encore admise peut être annulée.");
  }
  return findAdmissionById(params.hospitalId, params.id);
}

/** Clinically request discharge (admitted → discharge_requested). Guarded. */
export async function requestDischargeTx(params: { hospitalId: string; id: string }) {
  const res = await prisma.admission.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "admitted" },
    data: { status: "discharge_requested", dischargeRequestedAt: new Date() },
  });
  if (res.count === 0) {
    throw new Error("Seule une hospitalisation en cours peut demander une sortie.");
  }
  return findAdmissionById(params.hospitalId, params.id);
}

/**
 * Authorise discharge ((admitted | discharge_requested) → discharged) ATOMICALLY with the financial
 * gate. One `$transaction`: lock the encounter row FIRST (serialises with emergency-debt accrual, which
 * locks the same row), re-read the gate (open invoices + outstanding emergency debt) UNDER that lock so
 * a concurrent payment/accrual cannot make it stale, then transition only if the gate is clear. This
 * closes the check-then-act TOCTOU: no discharge can complete while money is owed, and a just-completed
 * payment is seen immediately (no false block).
 */
export async function authorizeDischargeTx(params: {
  hospitalId: string;
  id: string;
  encounterId: string;
  dischargedById: string;
}) {
  await prisma.$transaction(async (tx) => {
    const enc = await tx.encounter.findFirst({
      where: { id: params.encounterId, hospitalId: params.hospitalId },
    });
    if (!enc) throw new Error("Visite introuvable dans cet hôpital.");
    await tx.encounter.update({ where: { id: params.encounterId }, data: { updatedAt: new Date() } });

    // Re-read the gate inside the tx (sequential — interactive tx is single-connection).
    const unpaidInvoiceCount = await tx.invoice.count({
      where: {
        hospitalId: params.hospitalId,
        encounterId: params.encounterId,
        deletedAt: null,
        status: { notIn: ["paid", "cancelled"] },
      },
    });
    const outstandingEmergencyDebt = await tx.emergencyDebt.count({
      where: { hospitalId: params.hospitalId, encounterId: params.encounterId, status: "outstanding" },
    });
    const block = computeDischargeBlock({ unpaidInvoiceCount, outstandingEmergencyDebt });
    if (block.blocked) throw new Error(`Sortie impossible : ${block.reasons.join(" ; ")}.`);

    const res = await tx.admission.updateMany({
      where: {
        id: params.id,
        hospitalId: params.hospitalId,
        status: { in: ["admitted", "discharge_requested"] },
      },
      data: {
        status: "discharged",
        dischargedById: params.dischargedById,
        dischargedAt: new Date(),
      },
    });
    if (res.count === 0) {
      throw new Error("Cette hospitalisation ne peut pas être clôturée dans son état actuel.");
    }
  });
  return findAdmissionById(params.hospitalId, params.id);
}

export function listDailyChargesForAdmission(hospitalId: string, admissionId: string) {
  return prisma.admissionDailyCharge.findMany({
    where: { hospitalId, admissionId },
    orderBy: { chargeDate: "asc" },
  });
}

export type DailyChargeTxResult = {
  created: boolean;
  chargeId: string;
  amount: number;
  invoiceId: string;
};

/**
 * Accrue ONE daily ward fee, ATOMICALLY and IDEMPOTENTLY:
 *  - locks the admission row + asserts it is still `admitted`;
 *  - if a charge already exists for `chargeDate`, returns it (no double-bill);
 *  - otherwise lazily creates the hospitalization invoice on first charge (using `newInvoiceNumber`),
 *    appends a daily-fee InvoiceItem, bumps the invoice total, and records the `AdmissionDailyCharge`.
 * The per-day `@@unique` is the idempotency backstop; the row lock serialises concurrent accruals.
 */
export async function accrueDailyChargeTx(params: {
  hospitalId: string;
  admissionId: string;
  chargeDate: Date;
  label: string;
  newInvoiceNumber: string | null;
  createdById: string;
}): Promise<DailyChargeTxResult> {
  return prisma.$transaction(async (tx) => {
    // Take the admission row's write lock AND read it FRESH in one step. Reading `invoiceId` only AFTER
    // the lock (not from a pre-lock snapshot) is what prevents a concurrent first-charge from creating a
    // second, orphaned invoice: the second accrual blocks on the lock, then sees the invoiceId the first
    // one set. (`update` by the unique `id` returns the post-lock row.)
    let adm;
    try {
      adm = await tx.admission.update({
        where: { id: params.admissionId },
        data: { updatedAt: new Date() },
      });
    } catch {
      throw new Error("Hospitalisation introuvable dans cet hôpital.");
    }
    if (adm.hospitalId !== params.hospitalId) {
      throw new Error("Hospitalisation introuvable dans cet hôpital.");
    }
    if (adm.status !== "admitted") {
      throw new Error("Les frais journaliers ne s'appliquent qu'à une hospitalisation en cours.");
    }
    if (adm.dailyWardFee <= 0) {
      throw new Error("Aucun tarif journalier valide n'est défini pour cette hospitalisation.");
    }

    const existing = await tx.admissionDailyCharge.findFirst({
      where: { hospitalId: params.hospitalId, admissionId: adm.id, chargeDate: params.chargeDate },
    });
    if (existing) {
      return { created: false, chargeId: existing.id, amount: existing.amount, invoiceId: adm.invoiceId ?? "" };
    }

    // Lazily create the hospitalization invoice on the first daily charge (using the FRESH invoiceId).
    let invoiceId = adm.invoiceId;
    if (!invoiceId) {
      if (!params.newInvoiceNumber) {
        throw new Error("Numéro de facture d'hospitalisation manquant.");
      }
      const invoice = await tx.invoice.create({
        data: {
          hospitalId: params.hospitalId,
          encounterId: adm.encounterId,
          invoiceNumber: params.newInvoiceNumber,
          status: "issued",
          totalAmount: 0,
          createdById: params.createdById,
        },
      });
      invoiceId = invoice.id;
      await tx.admission.update({ where: { id: adm.id }, data: { invoiceId } });
    }

    const item = await tx.invoiceItem.create({
      data: {
        hospitalId: params.hospitalId,
        invoiceId,
        tariffId: adm.dailyFeeTariffId, // link the line to the ward tariff for a complete audit chain
        label: params.label,
        quantity: 1,
        unitAmount: adm.dailyWardFee,
        lineTotal: adm.dailyWardFee,
      },
    });
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { totalAmount: { increment: adm.dailyWardFee }, status: "issued" },
    });
    const charge = await tx.admissionDailyCharge.create({
      data: {
        hospitalId: params.hospitalId,
        admissionId: adm.id,
        chargeDate: params.chargeDate,
        amount: adm.dailyWardFee,
        invoiceItemId: item.id,
        createdById: params.createdById,
      },
    });
    return { created: true, chargeId: charge.id, amount: charge.amount, invoiceId };
  });
}
