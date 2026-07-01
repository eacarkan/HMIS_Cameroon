import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { formatDateTimeFr } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getAuditEntry } from "@/server/services";

/**
 * Audit event detail (Phase 1A Batch 4): a read-only view of one audit entry for admin
 * review. Requires `audit.read`; hospital-scoped. Append-only — no edit/delete.
 */
export default async function AuditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "audit.read")) redirect("/");
  const { id } = await params;
  const entry = await getAuditEntry(actor, hospital, id);
  if (!entry) notFound();

  const t = await getTranslations("auditLog");
  const label = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;

  return (
    <>
      <PageHeader
        title={t("detailTitle")}
        description={label}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/journal-audit">{t("backToList")}</Link>
          </Button>
        }
      />
      <Card className="max-w-2xl">
        <CardContent className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 pt-6 text-sm">
          <Row label={t("colTime")} value={formatDateTimeFr(new Date(entry.createdAt))} />
          <Row label={t("colActor")} value={entry.actor?.displayName ?? "—"} />
          <Row label={t("colAction")} value={`${label} (${entry.action})`} />
          <Row label={t("colEntity")} value={`${entry.entityType}${entry.entityId ? ` · ${entry.entityId}` : ""}`} />
          <Row label={t("colSummary")} value={entry.summary} />
        </CardContent>
      </Card>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </>
  );
}
