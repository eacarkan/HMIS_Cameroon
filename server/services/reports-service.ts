import { PAYMENT_METHOD_FR } from "@/lib/constants";
import { dayRange, todayIsoDate } from "@/lib/dates";
import { formatFcfa, sumFcfa } from "@/lib/money";
import { type HospitalContext, findPaymentsForDay } from "@/server/db";
import type { AuthenticatedActor } from "./auth-service";
import { requireCapability } from "./authz-service";
import { AUDIT_ACTIONS, recordAudit } from "./audit-service";

/**
 * Cashier daily report (Gate 5B, 12 §5.12). A simple, hospital-scoped, date-filtered read
 * over EXISTING recorded payments — NOT an accounting system (no ledger, treasury, refund,
 * tax or bank reconciliation). Integer FCFA. Read requires `cashier.report.read` (caissier,
 * admin, directeur). CSV export is audited (`cashier.daily_report.generate`).
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

export type CashierDailyReport = {
  date: string;
  hospitalName: string;
  rows: CashierReportRow[];
  total: number; // integer FCFA
  count: number;
  generatedAt: Date;
};

export async function getCashierDailyReport(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  date?: string,
): Promise<CashierDailyReport> {
  await requireCapability(actor, ctx, "cashier.report.read");

  const isoDate = date || todayIsoDate();
  const { start, end } = dayRange(isoDate);
  const payments = await findPaymentsForDay(ctx.hospitalId, start, end);

  const rows: CashierReportRow[] = payments.map((p) => {
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

  return {
    date: isoDate,
    hospitalName: ctx.name,
    rows,
    total: sumFcfa(rows.map((r) => r.amount)),
    count: rows.length,
    generatedAt: new Date(),
  };
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a simple CSV from the same hospital-scoped report data; audited as an export. */
export async function exportCashierDailyReportCsv(
  actor: AuthenticatedActor,
  ctx: HospitalContext,
  date?: string,
): Promise<{ csv: string; report: CashierDailyReport }> {
  const report = await getCashierDailyReport(actor, ctx, date); // re-checks capability
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
  const csv = lines.join("\n") + "\n";

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
