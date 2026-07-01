import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AddToQueueForm } from "@/components/queue/add-to-queue-form";
import { QueueBoard, type QueueTicketRow } from "@/components/queue/queue-board";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { compareQueueTickets, type QueueStatusValue } from "@/lib/queue";
import { requireActorAndHospital } from "@/server/auth";
import { getQueueForService, listActiveServices } from "@/server/services";

/** Phase 2F — simple per-service digital queue board (today). */
export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "queue.read")) redirect("/");

  const sp = await searchParams;
  const services = await listActiveServices(actor, hospital);
  const selected = services.find((s) => s.id === sp.service) ?? services[0] ?? null;
  const selectedName = selected?.nameFr ?? selected?.name ?? "";
  const t = await getTranslations("queue");
  const canManage = can(actor.roles, "queue.manage");
  const canUrgent = can(actor.roles, "queue.urgent");

  const tickets: QueueTicketRow[] = selected
    ? (await getQueueForService(actor, hospital, selected.id))
        .map((tk) => ({
          id: tk.id,
          ticketNumber: tk.ticketNumber,
          status: tk.status as QueueStatusValue,
          isUrgent: tk.isUrgent,
          patient: {
            familyName: tk.patient.familyName,
            givenName: tk.patient.givenName,
            patientNumber: tk.patient.patientNumber,
          },
        }))
        .sort(compareQueueTickets)
    : [];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t("service")}</CardTitle>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noServices")}</p>
          ) : (
            <form method="GET" className="flex items-end gap-2">
              <select
                name="service"
                defaultValue={selected?.id}
                aria-label={t("service")}
                className="border-input bg-background h-9 w-72 rounded-md border px-2 text-sm"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameFr ?? s.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="border-input hover:bg-accent h-9 rounded-md border px-3 text-sm"
              >
                {t("show")}
              </button>
            </form>
          )}
        </CardContent>
      </Card>

      {selected && canManage ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">{t("addTitle", { service: selectedName })}</CardTitle>
          </CardHeader>
          <CardContent>
            <AddToQueueForm serviceUnitId={selected.id} canUrgent={canUrgent} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selected ? t("boardTitle", { service: selectedName }) : t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QueueBoard tickets={tickets} canManage={canManage} canUrgent={canUrgent} />
        </CardContent>
      </Card>
    </>
  );
}
