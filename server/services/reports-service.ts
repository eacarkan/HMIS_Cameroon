import { type MethodTotal, totalsByMethod } from "@/lib/billing-rules";
import { PAYMENT_METHOD_FR } from "@/lib/constants";
import { dayRange, todayIsoDate } from "@/lib/dates";
import { formatFcfa, sumFcfa } from "@/lib/money";
import { type HospitalContext, findPaymentsForDay } from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Cashier reporting (Gate 5B + Phase 1A Batch 3). Hospital-scoped, date-filtered reads over
 * EXISTING recorded payments (voided payments are excluded by the data-access query). NOT an
 * accounting system — no ledger, treasury, refund, tax or bank reconciliation; no external
 * payment/accounting integration. Integer FCFA. Read requires `cashier.report.read`; CSV
 * export and shift closing are audited.
 */
export type CashierReportRow = {
  receiptNumber: string;
  invoiceNumber: string;
  patientName: string;
  amount: number; // integer FCFA
  method: string;
  methodLabel: string;
  cashierName: string;
  paidAt: Date;
};

export type CashierReportFilters = { date?: string; method?: string };

export type MethodTotalLabelled = MethodTotal & { methodLabel: string };

export type CashierDailyReport = {
  date: string;
  hospitalName: string;
  method: string | null;
  rows: CashierReportRow[];
  byMethod: MethodTotalLabelled[];
  total: number; // integer FCFA
  count: number;
  generatedAt: Date;
};

function normalizeFilters(opts?: string | CashierReportFilters): CashierReportFilters {
  if (typeof opts === "string") return { date: opts };
  return opts ?? {};
}

function labelMethods(rows: MethodTotal[]): MethodTotalLabelled[] {
  return rows.map((r) => ({ ...r, methodLabel: PAYMENT_METHOD_FR[r.method] ?? r.method }));
}

export async function getCashierDailyReport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts?: string | CashierReportFilters,
): Promise<CashierDailyReport> {
  await requireCapability(actor, ctx, "cashier.report.read");

  const { date, method } = normalizeFilters(opts);
  const isoDate = date || todayIsoDate();
  const { start, end } = dayRange(isoDate);
  const payments = await findPaymentsForDay(ctx.hospitalId, start, end);

  const filtered = method ? payments.filter((p) => p.method === method) : payments;
  const rows: CashierReportRow[] = filtered.map((p) => {
    const patient = p.invoice.encounter.patient;
    return {
      receiptNumber: p.receiptNumber,
      invoiceNumber: p.invoice.invoiceNumber,
      patientName: `${patient.givenName} ${patient.familyName}`,
      amount: p.amount,
      method: p.method,
      methodLabel: PAYMENT_METHOD_FR[p.method] ?? p.method,
      cashierName: p.cashier?.displayName ?? "—",
      paidAt: p.paidAt,
    };
  });

  const agg = totalsByMethod(
    filtered.map((p) => ({ amount: p.amount, method: p.method, status: p.status })),
  );

  return {
    date: isoDate,
    hospitalName: ctx.name,
    method: method ?? null,
    rows,
    byMethod: labelMethods(agg.rows),
    total: sumFcfa(rows.map((r) => r.amount)),
    count: rows.length,
    generatedAt: new Date(),
  };
}

export type CashierShiftSummary = {
  date: string;
  cashierName: string;
  byMethod: MethodTotalLabelled[];
  total: number;
  count: number;
  generatedAt: Date;
};

/** The current cashier's own recorded payments for a day, totalled by payment mode. */
export async function getCashierShiftSummary(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  date?: string,
): Promise<CashierShiftSummary> {
  await requireCapability(actor, ctx, "cashier.report.read");
  const isoDate = date || todayIsoDate();
  const { start, end } = dayRange(isoDate);
  const payments = (await findPaymentsForDay(ctx.hospitalId, start, end)).filter(
    (p) => p.cashierId === actor.id,
  );
  const agg = totalsByMethod(
    payments.map((p) => ({ amount: p.amount, method: p.method, status: p.status })),
  );
  return {
    date: isoDate,
    cashierName: actor.displayName,
    byMethod: labelMethods(agg.rows),
    total: agg.total,
    count: agg.count,
    generatedAt: new Date(),
  };
}

/** Close the current cashier's shift — computes (reproducibly) and audits totals by mode. */
export async function closeCashierShift(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  date?: string,
): Promise<CashierShiftSummary> {
  await requireCapability(actor, ctx, "payment.record", { type: "Report" });
  const summary = await getCashierShiftSummary(actor, ctx, date);
  const breakdown =
    summary.byMethod.map((m) => `${m.methodLabel} ${formatFcfa(m.total)}`).join(", ") || "—";
  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.cashierShiftClose,
    entityType: "Report",
    entityId: null,
    summary: `Clôture de caisse (${summary.date}) — ${formatFcfa(summary.total)}, ${summary.count} reçu(s) [${breakdown}]`,
  });
  return summary;
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a CSV from the same hospital-scoped report data; audited as an export. */
export async function exportCashierDailyReportCsv(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  opts?: string | CashierReportFilters,
): Promise<{ csv: string; report: CashierDailyReport }> {
  const report = await getCashierDailyReport(actor, ctx, opts); // re-checks capability
  const header = ["Date", "N° reçu", "N° facture", "Patient", "Montant (FCFA)", "Mode", "Caissier"];
  const lines = [header.map(csvCell).join(",")];
  for (const r of report.rows) {
    lines.push(
      [report.date, r.receiptNumber, r.invoiceNumber, r.patientName, r.amount, r.methodLabel, r.cashierName]
        .map(csvCell)
        .join(","),
    );
  }
  lines.push(["Total", "", "", "", report.total, "", ""].map(csvCell).join(","));
  // Export hardening: UTF-8 BOM + CRLF so spreadsheets render the French accents correctly.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";

  await recordAudit({
    hospitalId: ctx.hospitalId,
    actorId: actor.id,
    action: AUDIT_ACTIONS.cashierDailyReport,
    entityType: "Report",
    entityId: null,
    summary: `Export du rapport de caisse (${report.date}) — ${formatFcfa(report.total)}, ${report.count} reçu(s)`,
  });

  return { csv, report };
}
