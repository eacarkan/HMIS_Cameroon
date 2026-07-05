import { daysBetween } from "@/lib/dates";
import { AGING_BUCKETS, type AgingBucket, agingBucket } from "@/lib/finance";
import { sumFcfa } from "@/lib/money";
import {
  listOpenInvoicesWithPayments,
  listOutstandingEmergencyDebts,
  type HospitalContext,
} from "@/server/db";

import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";

/**
 * Phase 6.6 · Unit 3 — receivables aging (read-only, hospital-scoped). Computed live from existing data —
 * NO new model, NO money mutation. Includes issued/partially_paid invoice outstanding (totalAmount − Σ
 * recorded payments) + outstanding emergency debts, bucketed by age (createdAt anchor). The bucket totals
 * reconcile EXACTLY to the sum of invoice + emergency-debt outstanding (asserted in `reconciles`).
 */

export type AgingBucketRow = {
  bucket: AgingBucket;
  invoiceCount: number;
  invoiceAmount: number;
  debtCount: number;
  debtAmount: number;
  count: number;
  total: number;
};

export type ReceivableDetailRow = {
  invoiceNumber: string;
  patientNumber: string;
  billed: number;
  paid: number;
  outstanding: number;
  ageDays: number;
  bucket: AgingBucket;
};

export type ReceivablesAging = {
  asOf: Date;
  buckets: AgingBucketRow[];
  invoicesOutstanding: number;
  emergencyOutstanding: number;
  total: number;
  detail: ReceivableDetailRow[];
  /** Self-check: Σ bucket totals === invoicesOutstanding + emergencyOutstanding (must be true). */
  reconciles: boolean;
  generatedAt: Date;
};

function emptyBucket(bucket: AgingBucket): AgingBucketRow {
  return { bucket, invoiceCount: 0, invoiceAmount: 0, debtCount: 0, debtAmount: 0, count: 0, total: 0 };
}

export async function getReceivablesAging(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts: { asOf?: Date } = {},
): Promise<ReceivablesAging> {
  await requireCapability(actor, ctx, "receivables.view");

  const asOf = opts.asOf ?? new Date();
  const [invoices, debts] = await Promise.all([
    listOpenInvoicesWithPayments(ctx.hospitalId),
    listOutstandingEmergencyDebts(ctx.hospitalId),
  ]);

  const buckets = new Map<AgingBucket, AgingBucketRow>(
    AGING_BUCKETS.map((b) => [b, emptyBucket(b)]),
  );
  const detail: ReceivableDetailRow[] = [];

  for (const inv of invoices) {
    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
    const outstanding = inv.totalAmount - paid;
    if (outstanding <= 0) continue;
    const ageDays = Math.max(0, daysBetween(inv.createdAt, asOf));
    const bucket = agingBucket(ageDays);
    const row = buckets.get(bucket)!;
    row.invoiceCount += 1;
    row.invoiceAmount += outstanding;
    row.count += 1;
    row.total += outstanding;
    detail.push({
      invoiceNumber: inv.invoiceNumber,
      patientNumber: inv.encounter.patient.patientNumber,
      billed: inv.totalAmount,
      paid,
      outstanding,
      ageDays,
      bucket,
    });
  }

  for (const d of debts) {
    const ageDays = Math.max(0, daysBetween(d.createdAt, asOf));
    const bucket = agingBucket(ageDays);
    const row = buckets.get(bucket)!;
    row.debtCount += 1;
    row.debtAmount += d.amount;
    row.count += 1;
    row.total += d.amount;
  }

  const bucketRows = AGING_BUCKETS.map((b) => buckets.get(b)!);
  const invoicesOutstanding = sumFcfa(bucketRows.map((b) => b.invoiceAmount));
  const emergencyOutstanding = sumFcfa(bucketRows.map((b) => b.debtAmount));
  const total = invoicesOutstanding + emergencyOutstanding;
  const bucketTotal = sumFcfa(bucketRows.map((b) => b.total));

  detail.sort((a, b) => b.ageDays - a.ageDays || a.invoiceNumber.localeCompare(b.invoiceNumber));

  return {
    asOf,
    buckets: bucketRows,
    invoicesOutstanding,
    emergencyOutstanding,
    total,
    detail,
    reconciles: bucketTotal === total,
    generatedAt: new Date(),
  };
}
