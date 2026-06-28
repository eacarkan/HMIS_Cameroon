import { ReceiptText } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  CreateDepartmentForm,
  CreateServiceUnitForm,
  UpdateSettingForm,
  CreateTemplateForm,
  DeactivateButton,
} from "@/components/admin/config-forms";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/rbac";
import { requireActorAndHospital } from "@/server/auth";
import {
  listDepartments,
  listServiceUnits,
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

  const t = await getTranslations("admin");
  const [departments, serviceUnits, settings, templates] = await Promise.all([
    listDepartments(actor, hospital),
    listServiceUnits(actor, hospital),
    listSettings(actor, hospital),
    listDocumentTemplates(actor, hospital),
  ]);
  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          can(actor.roles, "tariff.read") ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/administration/tarifs">
                <ReceiptText className="size-4" aria-hidden />
                {t("manageTariffs")}
              </Link>
            </Button>
          ) : undefined
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

        <Section title={t("serviceUnits")}>
          {serviceUnits.length === 0 ? (
            <Empty>{t("noServiceUnits")}</Empty>
          ) : (
            <ul className="divide-y text-sm">
              {serviceUnits.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-medium">{u.name}</span>{" "}
                    <span className="text-muted-foreground text-xs">
                      ({u.code}
                      {u.departmentId ? ` · ${deptNameById.get(u.departmentId) ?? ""}` : ""})
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge active={u.isActive} activeLabel={t("active")} inactiveLabel={t("inactive")} />
                    {canManage && u.isActive ? (
                      <DeactivateButton kind="serviceUnit" id={u.id} />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <CreateServiceUnitForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
          ) : null}
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
