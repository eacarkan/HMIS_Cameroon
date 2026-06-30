import { Prisma } from "@prisma/client";

import { computeBrouillard, type BrouillardTotals } from "@/lib/cashier-closing";
import { formatFcfa } from "@/lib/money";
import {
  closeCashierShiftRow,
  createCashierShift,
  createShiftCorrection,
  findCashierPaymentsForWindow,
  findCashierShiftById,
  findExecutedRefundsForWindow,
  findOpenCashierShift,
  listCashierShifts as listCashierShiftsDb,
  markCashierShiftCorrected,
  type HospitalContext,
} from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import { generateNumber } from "./numbering-service";

/**
 * Phase 2C — cashier shift / Brouillard de Caisse. A cashier opens a shift with an opening balance,
 * then closes it: the five mandatory totals are computed deterministically over the shift window and
 * FROZEN. A closed Brouillard is immutable; corrections are appended (the figures never change).
 * Shift totals come from the cashier's recorded payments within [openedAt, closedAt) (no Payment FK).
 */

export async function getOpenShift(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "cashier.shift.manage");
  return findOpenCashierShift(ctx.hospitalId, actor.id);
}

export async function getCashierShift(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "cashier.report.read");
  return findCashierShiftById(ctx.hospitalId, id);
}

export async function listShifts(actor: AuthenticatedActor, ctx: HospitalContext) {
  await requireCapability(actor, ctx, "cashier.report.read");
  return listCashierShiftsDb(ctx.hospitalId);
}

/** Live (not yet frozen) totals for an OPEN shift — for display before close. */
export async function previewShiftTotals(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
): Promise<BrouillardTotals | null> {
  await requireCapability(actor, ctx, "cashier.report.read");
  const shift = await findCashierShiftById(ctx.hospitalId, id);
  if (!shift || shift.status !== "open") return null;
  return computeShiftTotals(ctx, shift.cashierId, shift.openingBalance, shift.openedAt, new Date());
}

async function computeShiftTotals(
  ctx: HospitalContext,
  cashierId: string,
  openingBalance: number,
  start: Date,
  end: Date,
): Promise<BrouillardTotals> {
  const payments = await findCashierPaymentsForWindow(ctx.hospitalId, cashierId, start, end);
  const refunds = await findExecutedRefundsForWindow(ctx.hospitalId, start, end, cashierId);
  return computeBrouillard(
    openingBalance,
    payments.map((p) => ({ amount: p.amount, method: p.method, status: p.status })),
    refunds.map((r) => ({ amount: r.amount, status: r.status })),
  );
}

/** Open a shift with an opening balance (integer FCFA ≥ 0). Only one open shift per cashier. */
export async function openCashierShift(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  openingBalance: number,
) {
  await requireCapability(actor, ctx, "cashier.shift.manage");
  if (!Number.isInteger(openingBalance) || openingBalance < 0) {
    throw new Error("Le fonds de caisse initial doit être un entier positif (FCFA).");
  }
  const existing = await findOpenCashierShift(ctx.hospitalId, actor.id);
  if (existing) throw new Error("Une caisse est déjà ouverte. Clôturez-la avant d'en ouvrir une autre.");

  const year = new Date().getFullYear();
  const shiftNumber = await generateNumber(ctx, "cashier_shift", year);
  // The pre-check above is a fast UX failure; the partial unique index
  // (CashierShift_one_open_per_cashier, status='open') is the race backstop — a concurrent second
  // open hits it and we surface the same message instead of a raw constraint error.
  let shift;
  try {
    shift = await createCashierShift({
      hospitalId: ctx.hospitalId,
      shiftNumber,
      cashierId: actor.id,
      openingBalance,
    });
  } catch (error) {
    // A unique-violation here is the open-shift partial index losing the race (shift numbers are
    // sequential, so they don't collide) — surface the same friendly message.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Une caisse est déjà ouverte. Clôturez-la avant d'en ouvrir une autre.");
    }
    throw error;
  }

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.cashierShiftOpened,
    entityType: "CashierShift",
    entityId: shift.id,
    summary: `Ouverture de caisse ${shift.shiftNumber} — fonds initial ${formatFcfa(openingBalance)}`,
  });
  return shift;
}

/** Close the cashier's own OPEN shift — freezes the five totals; the Brouillard becomes immutable. */
export async function closeCashierShift(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
) {
  await requireCapability(actor, ctx, "cashier.shift.manage", { type: "CashierShift", id });
  const shift = await findCashierShiftById(ctx.hospitalId, id);
  if (!shift) throw new Error("Caisse introuvable dans cet hôpital.");
  if (shift.cashierId !== actor.id) throw new Error("Vous ne pouvez clôturer que votre propre caisse.");
  if (shift.status !== "open") throw new Error("Cette caisse est déjà clôturée.");

  const closedAt = new Date();
  const totals = await computeShiftTotals(ctx, shift.cashierId, shift.openingBalance, shift.openedAt, closedAt);
  await closeCashierShiftRow(ctx.hospitalId, id, {
    closedById: actor.id,
    closedAt,
    totalCashReceived: totals.totalCashReceived,
    totalMobileCardReceived: totals.totalMobileCardReceived,
    totalCancellationsRefunds: totals.totalCancellationsRefunds,
    expectedClosingBalance: totals.expectedClosingBalance,
    receiptCount: totals.receiptCount,
  });

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.cashierShiftClosed,
    entityType: "CashierShift",
    entityId: id,
    summary:
      `Clôture de caisse ${shift.shiftNumber} — espèces ${formatFcfa(totals.totalCashReceived)}, ` +
      `mobile/carte ${formatFcfa(totals.totalMobileCardReceived)}, ` +
      `annulations/remboursements ${formatFcfa(totals.totalCancellationsRefunds)}, ` +
      `solde théorique ${formatFcfa(totals.expectedClosingBalance)} (${totals.receiptCount} reçu(s))`,
  });
  return findCashierShiftById(ctx.hospitalId, id);
}

/**
 * Append a controlled correction to a CLOSED Brouillard. The frozen figures are NEVER modified —
 * this records a reason + note and flips the status to `corrected`. Fully audited.
 */
export async function correctCashierShift(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  id: string,
  reason: string,
  note: string,
) {
  await requireCapability(actor, ctx, "cashier.shift.manage", { type: "CashierShift", id });
  const shift = await findCashierShiftById(ctx.hospitalId, id);
  if (!shift) throw new Error("Caisse introuvable dans cet hôpital.");
  if (shift.cashierId !== actor.id) {
    throw new Error("Vous ne pouvez corriger que votre propre brouillard.");
  }
  if (shift.status === "open") {
    throw new Error("Une caisse ouverte ne se corrige pas — clôturez-la d'abord.");
  }
  if (reason.trim().length === 0 || note.trim().length === 0) {
    throw new Error("Le motif et la note de correction sont obligatoires.");
  }

  const correction = await createShiftCorrection({
    hospitalId: ctx.hospitalId,
    cashierShiftId: id,
    reason: reason.trim(),
    note: note.trim(),
    correctedById: actor.id,
  });
  await markCashierShiftCorrected(ctx.hospitalId, id);

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.cashierClosingCorrected,
    entityType: "CashierShift",
    entityId: id,
    summary: `Correction du brouillard ${shift.shiftNumber} — motif : ${reason.trim()}`,
  });
  return { shift: await findCashierShiftById(ctx.hospitalId, id), correction };
}
