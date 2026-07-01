import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { listAuditEntries } from "@/server/services";

/**
 * Journal d'audit (06 §10, 09 §7): a compact, read-only table of significant actions
 * for the active hospital, with a light action filter. Visible only with `audit.read`.
 */
export default async function JournalAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "audit.read")) redirect("/");

  const { action } = await searchParams;
  const entries = await listAuditEntries(actor, hospital, {
    action: action || undefined,
  });
  const t = await getTranslations("auditLog");

  const filter = (
    <form action="/journal-audit">
      <select
        name="action"
        defaultValue={action ?? ""}
        className="border-input bg-card h-9 rounded-md border px-3 text-sm"
        aria-label={t("filterAction")}
      >
        <option value="">{t("allActions")}</option>
        {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </form>
  );

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={filter}
      />

      <div className="bg-card ring-foreground/5 overflow-hidden rounded-xl ring-1">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("colTime")}</th>
              <th className="px-4 py-2.5 font-medium">{t("colActor")}</th>
              <th className="px-4 py-2.5 font-medium">{t("colAction")}</th>
              <th className="px-4 py-2.5 font-medium">{t("colEntity")}</th>
              <th className="px-4 py-2.5 font-medium">{t("colSummary")}</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-muted-foreground px-4 py-8 text-center"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="tnum text-muted-foreground px-4 py-2.5 whitespace-nowrap">
                    {formatDateTimeFr(new Date(entry.createdAt))}
                  </td>
                  <td className="px-4 py-2.5">
                    {entry.actor?.displayName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={
                        entry.action === "authz.denied"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground px-4 py-2.5">
                    {entry.entityType}
                  </td>
                  <td className="px-4 py-2.5">{entry.summary}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link
                      href={`/journal-audit/${entry.id}`}
                      className="text-primary text-xs hover:underline"
                    >
                      {t("detail")}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
