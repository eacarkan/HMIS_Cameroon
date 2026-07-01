import { requireActorAndHospital } from "@/server/auth";
import { AuthorizationError } from "@/server/authz";
import { exportCashierDailyReportCsv } from "@/server/services";

/**
 * Cashier daily report CSV export (Gate 5B, Part B). Server-side, hospital-scoped,
 * RBAC-enforced (via the service) and audited. Integer FCFA. Calls the service — never
 * Prisma — so the architecture guardrail holds. Fake data only in dev/test.
 */
export async function GET(request: Request) {
  const { actor, hospital } = await requireActorAndHospital();
  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? undefined;
  const method = params.get("method") ?? undefined;

  try {
    const { csv, report } = await exportCashierDailyReportCsv(actor, hospital, { date, method });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="rapport-caisse-${report.date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return new Response("Action non autorisée.", { status: 403 });
    }
    throw error;
  }
}
