import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CloseShiftButton, OpenShiftForm } from "@/components/billing/brouillard-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeFr } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import { getOpenShift, listShifts, previewShiftTotals } from "@/server/services";

/** Phase 2C — Brouillard de Caisse management (cashier): open / close + recent brouillards. */
export default async function BrouillardPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "cashier.shift.manage")) redirect("/");

  const openShift = await getOpenShift(actor, hospital);
  const live = openShift ? await previewShiftTotals(actor, hospital, openShift.id) : null;
  const shifts = await listShifts(actor, hospital);
  const t = await getTranslations("brouillard");
  const statusLabel = (s: string) =>
    s === "open" ? t("statusOpen") : s === "closed" ? t("statusClosed") : t("statusCorrected");

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {openShift ? t("openShift") : t("openTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!openShift ? (
              <OpenShiftForm />
            ) : (
              <>
                <p className="text-muted-foreground text-xs">
                  {openShift.shiftNumber} · {t("openedAt")}:{" "}
                  {formatDateTimeFr(new Date(openShift.openedAt))}
                </p>
                <dl className="space-y-1">
                  <Row label={t("openingBalance")} value={formatFcfa(openShift.openingBalance)} />
                  {live ? (
                    <>
                      <Row label={t("totalCashReceived")} value={formatFcfa(live.totalCashReceived)} />
                      <Row
                        label={t("totalMobileCardReceived")}
                        value={formatFcfa(live.totalMobileCardReceived)}
                      />
                      <Row
                        label={t("totalCancellationsRefunds")}
                        value={formatFcfa(live.totalCancellationsRefunds)}
                      />
                      <Row
                        label={t("expectedClosingBalance")}
                        value={formatFcfa(live.expectedClosingBalance)}
                        strong
                      />
                    </>
                  ) : null}
                </dl>
                <p className="text-muted-foreground text-xs">{t("liveTotals")}</p>
                <div className="flex gap-2">
                  <CloseShiftButton shiftId={openShift.id} />
                  <Link
                    href={`/caisse/brouillard/${openShift.id}`}
                    className="text-sm underline self-center"
                  >
                    {t("view")}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("history")}</CardTitle>
          </CardHeader>
          <CardContent>
            {shifts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noShifts")}</p>
            ) : (
              <ul className="divide-y text-sm">
                {shifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <Link
                        href={`/caisse/brouillard/${s.id}`}
                        className="hover:text-primary font-medium"
                      >
                        {s.shiftNumber}
                      </Link>{" "}
                      <span className="text-muted-foreground text-xs">{s.cashier.displayName}</span>
                    </span>
                    <Badge variant="secondary">{statusLabel(s.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
