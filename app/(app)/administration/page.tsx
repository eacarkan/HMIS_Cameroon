import { Pill, ReceiptText, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreateDepartmentForm,
  UpdateSettingForm,
  CreateTemplateForm,
  DeactivateButton,
} from "@/components/admin/config-forms";
import { ServiceCatalogueSection } from "@/components/admin/service-catalogue";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import {
  listDepartments,
  listServiceCatalogue,
  listActiveServices,
  listSettings,
  listDocumentTemplates,
} from "@/server/services";

/**
 * Administration / configuration (Gate 4, 25 §10). Server-rendered lists via the Gate 3
 * config-service (RBAC + hospital scoping + audit). Visible to config readers; mutation
 * forms shown only to admins (server-side RBAC remains authoritative). No schema fork.
 */
export default async function AdministrationPage() {
  const { actor, hospital } = await requireActorAndHospital();
  if (!can(actor.roles, "config.read")) redirect("/");
  const canManage = can(actor.roles, "config.manage");
  const canManageServices = can(actor.roles, "service.config.manage");

  const t = await getTranslations("admin");
  const [departments, settings, templates] = await Promise.all([
    listDepartments(actor, hospital),
    listSettings(actor, hospital),
    listDocumentTemplates(actor, hospital),
  ]);
  // Phase 2A — service catalogue: admins get the full (incl. inactive) management view; other
  // config readers get the active-only read view (service.config.view).
  const serviceUnits = canManageServices
    ? await listServiceCatalogue(actor, hospital)
    : await listActiveServices(actor, hospital);
  const serviceRows = serviceUnits.map((u) => ({
    id: u.id,
    code: u.code,
    name: u.name,
    nameFr: u.nameFr,
    nameEn: u.nameEn,
    type: u.type,
    displayOrder: u.displayOrder,
    isActive: u.isActive,
    departmentId: u.departmentId,
    acceptsQueue: u.acceptsQueue,
    acceptsConsultation: u.acceptsConsultation,
    supportsBilling: u.supportsBilling,
    supportsPharmacy: u.supportsPharmacy,
    supportsLab: u.supportsLab,
    supportsImaging: u.supportsImaging,
    isInpatientWard: u.isInpatientWard,
    isEmergency: u.isEmergency,
  }));
  const deptOptions = departments.map((d) => ({ id: d.id, name: d.name }));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            {can(actor.roles, "user.manage") ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/administration/utilisateurs">
                  <Users className="size-4" aria-hidden />
                  {t("manageUsers")}
                </Link>
              </Button>
            ) : null}
            {can(actor.roles, "tariff.read") ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/administration/tarifs">
                  <ReceiptText className="size-4" aria-hidden />
                  {t("manageTariffs")}
                </Link>
              </Button>
            ) : null}
            {can(actor.roles, "medication.manage") ? (
              <Button asChild variant="secondary" size="sm">
                <Link href="/administration/medicaments">
                  <Pill className="size-4" aria-hidden />
                  {t("manageMedications")}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {!canManage ? (
        <p className="text-muted-foreground -mt-2 mb-4 text-sm">{t("readOnlyNotice")}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("departments")}>
          {departments.length === 0 ? (
            <Empty>{t("noDepartments")}</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {departments.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{d.name}</span>{" "}
                    <span className="text-muted-foreground tnum text-xs">({d.code})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge active={d.isActive} activeLabel={t("active")} inactiveLabel={t("inactive")} />
                    {canManage && d.isActive ? (
                      <DeactivateButton kind="department" id={d.id} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage ? <CreateDepartmentForm /> : null}
        </Section>

        <Section title={t("serviceCatalogue.title")}>
          <p className="text-muted-foreground -mt-2 mb-3 text-xs">
            {t("serviceCatalogue.subtitle")}
          </p>
          {canManageServices ? (
            <ServiceCatalogueSection services={serviceRows} departments={deptOptions} />
          ) : serviceRows.length === 0 ? (
            <Empty>{t("serviceCatalogue.none")}</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {serviceRows.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{u.nameFr ?? u.name}</span>{" "}
                    <span className="text-muted-foreground text-xs">({u.code})</span>
                  </span>
                  <StatusBadge active={u.isActive} activeLabel={t("active")} inactiveLabel={t("inactive")} />
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("settings")}>
          {settings.length === 0 ? (
            <Empty>{t("noSettings")}</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {settings.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted-foreground">{s.key}</span>
                  <span className="font-medium">{s.value}</span>
                </li>
              ))}
            </ul>
          )}
          {canManage ? <UpdateSettingForm /> : null}
        </Section>

        <Section title={t("documentTemplates")}>
          {templates.length === 0 ? (
            <Empty>{t("noTemplates")}</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {templates.map((tpl) => (
                <li key={tpl.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{tpl.name}</span>{" "}
                    <span className="text-muted-foreground text-xs">({tpl.type})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge active={tpl.isActive} activeLabel={t("active")} inactiveLabel={t("inactive")} />
                    {canManage && tpl.isActive ? (
                      <DeactivateButton kind="template" id={tpl.id} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage ? <CreateTemplateForm /> : null}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

function StatusBadge({
  active,
  activeLabel,
  inactiveLabel,
}: {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge variant={active ? "secondary" : "outline"}>
      {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}
