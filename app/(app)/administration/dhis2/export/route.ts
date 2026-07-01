import { requireActorAndHospital } from "@/server/auth";
import { AuthorizationError } from "@/server/authz";
import { exportDhis2MappedCsv } from "@/server/services";
import { monthLabel, parseMonthParam } from "@/lib/reporting";

/**
 * Phase 4B — mapped DHIS2 CSV export (manual upload). Server-side, hospital-scoped, RBAC + audited via
 * the service; gated on a COMPLETE mapping set. AGGREGATE ONLY — the CSV carries period/org-unit/
 * data-element/age-band/gender/count rows, never any patient identifier. Synthetic data only.
 */
export async function GET(request: Request) {
  const { actor, hospital } = await requireActorAndHospital();
  const url = new URL(request.url);
  const mappingSetId = url.searchParams.get("mappingSetId") ?? "";
  const parsed = parseMonthParam(url.searchParams.get("month")) ?? parseMonthParam(monthLabel(new Date()))!;

  try {
    const { csv, periodLabel } = await exportDhis2MappedCsv(actor, hospital, { mappingSetId, ...parsed });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dhis2-mapped-${hospital.code}-${periodLabel}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) return new Response("Action non autorisée.", { status: 403 });
    if (error instanceof Error) return new Response(error.message, { status: 400 });
    throw error;
  }
}
