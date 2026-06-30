import type { DiagnosticModality } from "@prisma/client";

import { prisma } from "./prisma";

/**
 * Phase 2I — manual lab/radiology data-access (hospital-scoped; integer FCFA). Catalogue CRUD plus the
 * order lifecycle, whose transitions are guarded `updateMany` claims (so a concurrent double-decision
 * loses). The result-visibility rule is enforced in the service layer (`lib/diagnostics.isResultVisible`).
 */

// --- Catalogue (admin / lead-tech maintained) ---

export type CreateDiagnosticCatalogueItemData = {
  hospitalId: string;
  code: string;
  nameFr: string;
  nameEn?: string | null;
  modality: DiagnosticModality;
  price: number;
  displayOrder?: number;
};

export function listDiagnosticCatalogue(hospitalId: string) {
  return prisma.diagnosticCatalogueItem.findMany({
    where: { hospitalId },
    orderBy: [{ modality: "asc" }, { displayOrder: "asc" }, { code: "asc" }],
  });
}

export function listActiveDiagnosticCatalogue(hospitalId: string, modality?: DiagnosticModality) {
  return prisma.diagnosticCatalogueItem.findMany({
    where: { hospitalId, isActive: true, ...(modality ? { modality } : {}) },
    orderBy: [{ modality: "asc" }, { displayOrder: "asc" }, { code: "asc" }],
  });
}

export function findDiagnosticCatalogueItemById(hospitalId: string, id: string) {
  return prisma.diagnosticCatalogueItem.findFirst({ where: { id, hospitalId } });
}

export function createDiagnosticCatalogueItem(data: CreateDiagnosticCatalogueItemData) {
  return prisma.diagnosticCatalogueItem.create({
    data: {
      hospitalId: data.hospitalId,
      code: data.code,
      nameFr: data.nameFr,
      nameEn: data.nameEn ?? null,
      modality: data.modality,
      price: data.price,
      displayOrder: data.displayOrder ?? 0,
    },
  });
}

export function updateDiagnosticCatalogueItem(
  hospitalId: string,
  id: string,
  data: Partial<{ nameFr: string; nameEn: string | null; price: number; isActive: boolean; displayOrder: number }>,
) {
  return prisma.diagnosticCatalogueItem.updateMany({ where: { id, hospitalId }, data });
}

// --- Orders ---

export type CreateDiagnosticOrderData = {
  hospitalId: string;
  encounterId: string;
  patientId: string;
  catalogueItemId: string;
  orderNumber: string;
  modality: DiagnosticModality;
  itemLabel: string;
  price: number;
  requestedById?: string | null;
};

const ORDER_INCLUDE = {
  catalogueItem: true,
  encounter: { include: { patient: true } },
} as const;

export function createDiagnosticOrder(data: CreateDiagnosticOrderData) {
  return prisma.diagnosticOrder.create({
    data: {
      hospitalId: data.hospitalId,
      encounterId: data.encounterId,
      patientId: data.patientId,
      catalogueItemId: data.catalogueItemId,
      orderNumber: data.orderNumber,
      modality: data.modality,
      itemLabel: data.itemLabel,
      price: data.price,
      requestedById: data.requestedById ?? null,
    },
  });
}

export function findDiagnosticOrderById(hospitalId: string, id: string) {
  return prisma.diagnosticOrder.findFirst({ where: { id, hospitalId }, include: ORDER_INCLUDE });
}

export function listDiagnosticOrdersForEncounter(hospitalId: string, encounterId: string) {
  return prisma.diagnosticOrder.findMany({
    where: { hospitalId, encounterId },
    orderBy: { createdAt: "asc" },
  });
}

/** The lab/radiology worklist: active (non-terminal) orders, optionally filtered by modality. */
export function listDiagnosticWorklist(hospitalId: string, modality?: DiagnosticModality) {
  return prisma.diagnosticOrder.findMany({
    where: {
      hospitalId,
      ...(modality ? { modality } : {}),
      status: { in: ["requested", "payment_confirmed", "in_progress", "result_entered"] },
    },
    include: { encounter: { include: { patient: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Cashier confirms payment (requested → payment_confirmed). Guarded. */
export async function confirmDiagnosticPaymentTx(params: { hospitalId: string; id: string; paidById: string }) {
  const res = await prisma.diagnosticOrder.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "requested" },
    data: { status: "payment_confirmed", isPaid: true, paidAt: new Date(), paidById: params.paidById },
  });
  if (res.count === 0) throw new Error("Le paiement ne peut être confirmé que sur une demande en attente.");
  return findDiagnosticOrderById(params.hospitalId, params.id);
}

/** Technician starts the test ((requested | payment_confirmed) → in_progress). Guarded. Eligibility
 *  (paid or emergency) is checked in the service before this call. */
export async function startDiagnosticTx(params: { hospitalId: string; id: string }) {
  const res = await prisma.diagnosticOrder.updateMany({
    where: {
      id: params.id,
      hospitalId: params.hospitalId,
      status: { in: ["requested", "payment_confirmed"] },
    },
    data: { status: "in_progress" },
  });
  if (res.count === 0) throw new Error("Cet examen ne peut pas être démarré dans son état actuel.");
  return findDiagnosticOrderById(params.hospitalId, params.id);
}

/** Technician enters the manual result (in_progress → result_entered). Guarded. */
export async function enterDiagnosticResultTx(params: {
  hospitalId: string;
  id: string;
  resultText: string;
  resultEnteredById: string;
}) {
  const res = await prisma.diagnosticOrder.updateMany({
    where: { id: params.id, hospitalId: params.hospitalId, status: "in_progress" },
    data: {
      status: "result_entered",
      resultText: params.resultText,
      resultEnteredById: params.resultEnteredById,
      resultEnteredAt: new Date(),
    },
  });
  if (res.count === 0) throw new Error("Le résultat ne peut être saisi que sur un examen en cours.");
  return findDiagnosticOrderById(params.hospitalId, params.id);
}

/** Validator validates the result (result_entered → validated). Guarded — the claim also requires the
 *  validator to differ from the result enterer (4-eyes), as a DB-level backstop to the service check. */
export async function validateDiagnosticResultTx(params: { hospitalId: string; id: string; validatedById: string }) {
  const res = await prisma.diagnosticOrder.updateMany({
    where: {
      id: params.id,
      hospitalId: params.hospitalId,
      status: "result_entered",
      NOT: { resultEnteredById: params.validatedById },
    },
    data: { status: "validated", validatedById: params.validatedById, validatedAt: new Date() },
  });
  if (res.count === 0) throw new Error("Seul un résultat saisi (par une autre personne) peut être validé.");
  return findDiagnosticOrderById(params.hospitalId, params.id);
}

/** Cancel a pre-validation order. Guarded so a validated order can never be cancelled. */
export async function cancelDiagnosticTx(params: { hospitalId: string; id: string; cancelReason: string }) {
  const res = await prisma.diagnosticOrder.updateMany({
    where: {
      id: params.id,
      hospitalId: params.hospitalId,
      status: { in: ["requested", "payment_confirmed", "in_progress", "result_entered"] },
    },
    data: { status: "cancelled", cancelReason: params.cancelReason },
  });
  if (res.count === 0) throw new Error("Un examen validé ou déjà annulé ne peut pas être annulé.");
  return findDiagnosticOrderById(params.hospitalId, params.id);
}
