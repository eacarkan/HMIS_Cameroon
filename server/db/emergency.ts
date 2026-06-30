import type { EmergencyDebtStatus } from "@prisma/client";

import { prisma } from "./prisma";

/** Phase 2H — emergency-exception data-access (hospital-scoped; integer FCFA; append-only ledger). */

export type CreateEmergencyDebtData = {
  hospitalId: string;
  encounterId: string;
  patientId: string;
  amount: number;
  source: string;
  createdById?: string | null;
};

export function setEncounterEmergency(
  hospitalId: string,
  encounterId: string,
  isEmergency: boolean,
  flaggedById: string,
) {
  return prisma.encounter.updateMany({
    where: { id: encounterId, hospitalId },
    data: {
      isEmergency,
      emergencyFlaggedById: isEmergency ? flaggedById : null,
      emergencyFlaggedAt: isEmergency ? new Date() : null,
    },
  });
}

export function createEmergencyDebt(data: CreateEmergencyDebtData) {
  return prisma.emergencyDebt.create({ data });
}

/**
 * Accrue a debt ATOMICALLY, asserting the encounter is still emergency. One `$transaction`: a guarded
 * `updateMany(where isEmergency:true)` both ASSERTS the flag and takes the encounter row's write lock,
 * then the debt is created. This serialises against `unflagEncounterEmergencyTx` (which locks the same
 * row), so a concurrent un-flag can never leave `isEmergency=false` WITH outstanding debt.
 */
export async function accrueEmergencyDebtTx(data: CreateEmergencyDebtData) {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.encounter.updateMany({
      where: { id: data.encounterId, hospitalId: data.hospitalId, isEmergency: true },
      data: { updatedAt: new Date() },
    });
    if (lock.count === 0) {
      throw new Error("La dette d'urgence ne peut être enregistrée que sur une visite marquée urgence.");
    }
    return tx.emergencyDebt.create({ data });
  });
}

/**
 * Un-flag an emergency encounter ATOMICALLY. One `$transaction`: take the encounter row's write lock
 * FIRST (a touch), THEN count outstanding debt (so it sees any concurrently-committed accrual), then
 * clear the flag only if there is none — serialised with `accrueEmergencyDebtTx`.
 */
export async function unflagEncounterEmergencyTx(params: { hospitalId: string; encounterId: string }) {
  return prisma.$transaction(async (tx) => {
    const enc = await tx.encounter.findFirst({ where: { id: params.encounterId, hospitalId: params.hospitalId } });
    if (!enc) throw new Error("Visite introuvable dans cet hôpital.");
    await tx.encounter.update({ where: { id: params.encounterId }, data: { updatedAt: new Date() } });
    const outstanding = await tx.emergencyDebt.count({
      where: { hospitalId: params.hospitalId, encounterId: params.encounterId, status: "outstanding" },
    });
    if (outstanding > 0) {
      throw new Error("Impossible de retirer l'urgence : une dette d'urgence est encore en cours.");
    }
    await tx.encounter.updateMany({
      where: { id: params.encounterId, hospitalId: params.hospitalId },
      data: { isEmergency: false, emergencyFlaggedById: null, emergencyFlaggedAt: null },
    });
  });
}

export function findEmergencyDebtById(hospitalId: string, id: string) {
  return prisma.emergencyDebt.findFirst({ where: { id, hospitalId } });
}

export function listEmergencyDebtsForEncounter(hospitalId: string, encounterId: string) {
  return prisma.emergencyDebt.findMany({
    where: { hospitalId, encounterId },
    orderBy: { createdAt: "asc" },
  });
}

/** Decide (settle/waive) an OUTSTANDING entry. Guarded so a concurrent double-decision loses. */
export async function decideEmergencyDebt(params: {
  hospitalId: string;
  id: string;
  status: EmergencyDebtStatus; // settled | waived
  decidedById: string;
  decisionReason?: string | null;
}) {
  const res = await prisma.emergencyDebt.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "outstanding" },
    data: {
      status: params.status,
      decidedById: params.decidedById,
      decisionReason: params.decisionReason ?? null,
      decidedAt: new Date(),
    },
  });
  if (res.count === 0) throw new Error("Cette dette d'urgence a déjà été traitée.");
  return findEmergencyDebtById(params.hospitalId, params.id);
}

/** Count of still-outstanding emergency-debt entries on an encounter — the discharge gate (2G). */
export function countOutstandingEmergencyDebt(hospitalId: string, encounterId: string) {
  return prisma.emergencyDebt.count({ where: { hospitalId, encounterId, status: "outstanding" } });
}
