import { PAYMENT_METHOD_FR } from "@/lib/constants";
import { frMonthLabel, monthRange, parsePeriod, periodKey } from "@/lib/dates";
import { sumFcfa } from "@/lib/money";
import {
  countInvoicesIssuedInRange,
  findExecutedRefundsForWindow,
  findRecordedPaymentsInRange,
  sumInvoicedInRange,
  type HospitalContext,
} from "@/server/db";

import { AUDIT_ACTIONS, recordAudit } from "./audit-service";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { generateNumber } from "./numbering-service";

/**
 * Phase 6.6 · Unit 5 — "État mensuel numéroté des recettes" / Numbered monthly revenue statement.
 * An INTERNAL traceability summary (read-only aggregate over recorded payments) — NOT a certificate,
 * attestation or official accounting document. Reading the aggregate is free; assigning the deterministic
 * `lib/numbering` number is a separate, AUDITED act. No invoice/payment money field is written.
 */

export type RevenueMethodRow = { method: string; methodLabel: string; count: number; total: number };
export type RevenueStatement = {
  period: string;
  periodLabel: string;
  byMethod: RevenueMethodRow[];
  /** Total collected in the period (Σ recorded payments). `byMethod` sums to this. */
  total: number;
  paymentCount: number;
  /** Count of LIVE billed invoices (issued/partially_paid/paid) in the period. */
  invoiceCount: number;
  /** Total invoiced (gross billed, excludes draft + cancelled) in the period. */
  totalInvoiced: number;
  /** Refunds/reversals executed in the period (Σ paid RefundVoucher). */
  refundsTotal: number;
  /** Net collected = total collected − refunds. */
  netCollected: number;
  /** Arrears movement = total invoiced − total collected (positive = arrears grew this period). */
  arrearsMovement: number;
  hospitalName: string;
  generatedAt: Date;
};

export async function getRevenueStatement(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { period?: string } = {},
): Promise<RevenueStatement> {
  await requireCapability(actor, ctx, "revenue_statement.read");
  const { year, month } = parsePeriod(opts.period);
  const { start, end } = monthRange(year, month);

  const [payments, invoiceCount, totalInvoiced, refunds] = await Promise.all([
    findRecordedPaymentsInRange(ctx.hospitalId, start, end),
    countInvoicesIssuedInRange(ctx.hospitalId, start, end),
    sumInvoicedInRange(ctx.hospitalId, start, end),
    findExecutedRefundsForWindow(ctx.hospitalId, start, end),
  ]);

  const byMethodMap = new Map<string, { count: number; total: number }>();
  for (const p of payments) {
    const cur = byMethodMap.get(p.method) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += p.amount;
    byMethodMap.set(p.method, cur);
  }
  const byMethod = [...byMethodMap.entries()]
    .map(([method, v]) => ({ method, methodLabel: PAYMENT_METHOD_FR[method] ?? method, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total || a.method.localeCompare(b.method));

  const total = sumFcfa(payments.map((p) => p.amount));
  const refundsTotal = sumFcfa(refunds.map((r) => r.amount));

  return {
    period: periodKey(year, month),
    periodLabel: frMonthLabel(year, month),
    byMethod,
    total,
    paymentCount: payments.length,
    invoiceCount,
    totalInvoiced,
    refundsTotal,
    netCollected: total - refundsTotal,
    arrearsMovement: totalInvoiced - total,
    hospitalName: ctx.name,
    generatedAt: new Date(),
  };
}

/** Assign a deterministic numbered-statement id (lib/numbering) + audit it. No money field is written. */
export async function generateRevenueStatementNumber(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { period?: string } = {},
): Promise<{ number: string; period: string }> {
  await requireCapability(actor, ctx, "revenue_statement.read");
  const { year, month } = parsePeriod(opts.period);
  const number = await generateNumber(ctx, "revenue_statement", year);
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.revenueStatementGenerated,
    entityType: "RevenueStatement",
    entityId: number,
    summary: `État mensuel numéroté des recettes ${number} généré (${frMonthLabel(year, month)})`,
  });
  return { number, period: periodKey(year, month) };
}
