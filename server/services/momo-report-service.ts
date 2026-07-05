import { frMonthLabel, monthRange, parsePeriod, periodKey } from "@/lib/dates";
import { sumFcfa } from "@/lib/money";
import { findMobileMoneyPaymentsInRange, type HospitalContext } from "@/server/db";

import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";

/**
 * Phase 6.6 · Unit 2 — Mobile-Money per-operator collection report (read-only, hospital-scoped).
 * Aggregates the recorded `mobile_money` payments of a month by their operator SNAPSHOT (MTN / ORANGE /
 * …). Read-only: it never writes an Invoice/Payment field. Reuses the immutable operator/reference set at
 * payment time — no reconstruction, no external call.
 */

const UNKNOWN_OPERATOR = "—";

export type MomoOperatorRow = { operator: string; count: number; total: number };
export type MomoPaymentRow = {
  receiptNumber: string;
  amount: number;
  operator: string;
  reference: string | null;
  paidAt: Date;
};
export type MobileMoneyReport = {
  period: string;
  periodLabel: string;
  byOperator: MomoOperatorRow[];
  total: number;
  count: number;
  rows: MomoPaymentRow[];
  generatedAt: Date;
};

export async function getMobileMoneyReport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { period?: string } = {},
): Promise<MobileMoneyReport> {
  await requireCapability(actor, ctx, "momo.report.read");

  const { year, month } = parsePeriod(opts.period);
  const { start, end } = monthRange(year, month);
  const payments = await findMobileMoneyPaymentsInRange(ctx.hospitalId, start, end);

  const byOp = new Map<string, { count: number; total: number }>();
  for (const p of payments) {
    const op = p.mobileMoneyOperator?.trim() || UNKNOWN_OPERATOR;
    const cur = byOp.get(op) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += p.amount;
    byOp.set(op, cur);
  }
  const byOperator = [...byOp.entries()]
    .map(([operator, v]) => ({ operator, count: v.count, total: v.total }))
    .sort((a, b) => b.total - a.total || a.operator.localeCompare(b.operator));

  return {
    period: periodKey(year, month),
    periodLabel: frMonthLabel(year, month),
    byOperator,
    total: sumFcfa(payments.map((p) => p.amount)),
    count: payments.length,
    rows: payments.map((p) => ({
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      operator: p.mobileMoneyOperator?.trim() || UNKNOWN_OPERATOR,
      reference: p.mobileMoneyReference,
      paidAt: p.paidAt,
    })),
    generatedAt: new Date(),
  };
}
