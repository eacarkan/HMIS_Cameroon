import { requireActorAndHospital } from "@/server/auth";
import { AuthorizationError } from "@/server/authz";
import { exportDhis2Csv } from "@/server/services";
import { monthLabel, parseMonthParam } from "@/lib/reporting";

/**
 * Phase 2E — DHIS2-aligned monthly CSV export (manual upload). Server-side, hospital-scoped,
 * RBAC-enforced + audited via the service. AGGREGATE ONLY — the CSV carries period/org-unit/
 * data-element/age-band/gender/count rows, never any patient identifier. Synthetic data only.
 */
export async function GET(request: Request) {
  const { actor, hospital } = await requireActorAndHospital();
  const monthParam = new URL(request.url).searchParams.get("month");
  const parsed = parseMonthParam(monthParam) ?? parseMonthParam(monthLabel(new Date()))!;

  try {
    const { csv, periodLabel } = await exportDhis2Csv(actor, hospital, parsed);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dhis2-${hospital.code}-${periodLabel}.csv"`,
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
