"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ELIGIBILITY_FLAGS, SERVICE_TYPES } from "@/lib/service-catalogue";
import {
  createServiceUnitAction,
  deactivateServiceUnitAction,
  moveServiceAction,
  reactivateServiceUnitAction,
  setServiceEligibilityAction,
  updateServiceUnitAction,
  type ActionState,
} from "@/server/actions/config-actions";

/**
 * Service catalogue management (Phase 2A, client). Create / edit / deactivate / reactivate /
 * reorder + eligibility toggles over the hospital's service catalogue. Bilingual (Fr/En) via
 * next-intl keys; the server (`config-service`) remains the authoritative RBAC + audit gate.
 */
const initial: ActionState = {};

export type ServiceRow = {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  nameEn: string | null;
  type: string;
  displayOrder: number;
  isActive: boolean;
  departmentId: string | null;
  acceptsQueue: boolean;
  acceptsConsultation: boolean;
  supportsBilling: boolean;
  supportsPharmacy: boolean;
  supportsLab: boolean;
  supportsImaging: boolean;
  isInpatientWard: boolean;
  isEmergency: boolean;
};
export type DeptOption = { id: string; name: string };

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-xs">
      {msg}
    </p>
  ) : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function TypeSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const tType = useTranslations("serviceType");
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? "SUPPORT"}
      className="border-input bg-background h-9 rounded-md border px-2 text-sm"
    >
      {SERVICE_TYPES.map((tt) => (
        <option key={tt} value={tt}>
          {tType(tt)}
        </option>
      ))}
    </select>
  );
}

function DeptSelect({
  name,
  departments,
  defaultValue,
  noneLabel,
}: {
  name: string;
  departments: DeptOption[];
  defaultValue?: string | null;
  noneLabel: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue ?? ""}
      className="border-input bg-background h-9 rounded-md border px-2 text-sm"
    >
      <option value="">{noneLabel}</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function FlagCheckboxes({ values }: { values?: ServiceRow }) {
  const tf = useTranslations("admin.serviceCatalogue.flag");
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {ELIGIBILITY_FLAGS.map((f) => (
        <label key={f} className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" name={f} defaultChecked={Boolean(values?.[f])} />
          {tf(f)}
        </label>
      ))}
    </div>
  );
}

export function ServiceCreateForm({ departments }: { departments: DeptOption[] }) {
  const t = useTranslations("admin.serviceCatalogue");
  const formRef = useRef<HTMLFormElement>(null);
  // Clear the form after a successful create so the next entry starts blank (the list
  // re-renders with the new service via revalidatePath).
  const [state, action, pending] = useActionState(
    async (prev: ActionState, fd: FormData) => {
      const result = await createServiceUnitAction(prev, fd);
      if (result.ok) formRef.current?.reset();
      return result;
    },
    initial,
  );
  return (
    <form
      ref={formRef}
      action={action}
      className="bg-muted/40 mt-4 grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label={t("addService")}
    >
      <Field label={t("code")}>
        <Input name="code" required />
      </Field>
      <Field label={t("nameFr")}>
        <Input name="nameFr" required />
      </Field>
      <Field label={t("nameEn")}>
        <Input name="nameEn" />
      </Field>
      <Field label={t("serviceType")}>
        <TypeSelect name="type" />
      </Field>
      <Field label={t("displayOrder")}>
        <Input name="displayOrder" type="number" min={0} defaultValue={0} />
      </Field>
      <Field label={t("department")}>
        <DeptSelect name="departmentId" departments={departments} noneLabel={t("departmentNone")} />
      </Field>
      <fieldset className="sm:col-span-2 lg:col-span-3">
        <legend className="text-muted-foreground mb-1 text-xs">{t("eligibilities")}</legend>
        <FlagCheckboxes />
      </fieldset>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {t("addService")}
        </Button>
        <FormError state={state} />
      </div>
    </form>
  );
}

function ServiceEditForm({
  service,
  departments,
}: {
  service: ServiceRow;
  departments: DeptOption[];
}) {
  const t = useTranslations("admin.serviceCatalogue");
  const [state, action, pending] = useActionState(
    updateServiceUnitAction.bind(null, service.id),
    initial,
  );
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label={t("nameFr")}>
        <Input name="nameFr" defaultValue={service.nameFr ?? service.name} required />
      </Field>
      <Field label={t("nameEn")}>
        <Input name="nameEn" defaultValue={service.nameEn ?? ""} />
      </Field>
      <Field label={t("serviceType")}>
        <TypeSelect name="type" defaultValue={service.type} />
      </Field>
      <Field label={t("displayOrder")}>
        <Input name="displayOrder" type="number" min={0} defaultValue={service.displayOrder} />
      </Field>
      <Field label={t("department")}>
        <DeptSelect
          name="departmentId"
          departments={departments}
          defaultValue={service.departmentId}
          noneLabel={t("departmentNone")}
        />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {t("save")}
        </Button>
        <FormError state={state} />
      </div>
    </form>
  );
}

function ServiceEligibilityForm({ service }: { service: ServiceRow }) {
  const t = useTranslations("admin.serviceCatalogue");
  const [state, action, pending] = useActionState(
    setServiceEligibilityAction.bind(null, service.id),
    initial,
  );
  return (
    <form action={action} className="mt-3 border-t pt-3">
      <p className="text-muted-foreground mb-2 text-xs font-medium">{t("eligibilities")}</p>
      <FlagCheckboxes values={service} />
      <div className="mt-2 flex items-center gap-3">
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {t("saveEligibilities")}
        </Button>
        <FormError state={state} />
      </div>
    </form>
  );
}

function EligibilityBadges({ service }: { service: ServiceRow }) {
  const tf = useTranslations("admin.serviceCatalogue.flag");
  const on = ELIGIBILITY_FLAGS.filter((f) => service[f]);
  if (on.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {on.map((f) => (
        <Badge key={f} variant="outline" className="text-[10px]">
          {tf(f)}
        </Badge>
      ))}
    </span>
  );
}

export function ServiceCatalogueSection({
  services,
  departments,
}: {
  services: ServiceRow[];
  departments: DeptOption[];
}) {
  const t = useTranslations("admin.serviceCatalogue");
  const tType = useTranslations("serviceType");
  return (
    <div>
      {services.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("none")}</p>
      ) : (
        <ul className="divide-y text-sm">
          {services.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="tnum text-muted-foreground text-xs">{s.displayOrder}.</span>
                  <span className="font-medium">{s.nameFr ?? s.name}</span>
                  <span className="text-muted-foreground text-xs">({s.code})</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {tType(s.type)}
                  </Badge>
                  <Badge variant={s.isActive ? "secondary" : "outline"} className="text-[10px]">
                    {s.isActive ? t("active") : t("inactive")}
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <form action={moveServiceAction.bind(null, s.id, "up")}>
                    <Button type="submit" variant="ghost" size="icon" title={t("moveUp")}>
                      <ChevronUp className="size-4" aria-hidden />
                    </Button>
                  </form>
                  <form action={moveServiceAction.bind(null, s.id, "down")}>
                    <Button type="submit" variant="ghost" size="icon" title={t("moveDown")}>
                      <ChevronDown className="size-4" aria-hidden />
                    </Button>
                  </form>
                  {s.isActive ? (
                    <form action={deactivateServiceUnitAction.bind(null, s.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {t("deactivate")}
                      </Button>
                    </form>
                  ) : (
                    <form action={reactivateServiceUnitAction.bind(null, s.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {t("reactivate")}
                      </Button>
                    </form>
                  )}
                </span>
              </div>
              <div className="mt-1.5">
                <EligibilityBadges service={s} />
              </div>
              <details className="mt-2">
                <summary className="text-primary cursor-pointer text-xs">{t("editService")}</summary>
                <div className="mt-3 space-y-1">
                  <ServiceEditForm service={s} departments={departments} />
                  <ServiceEligibilityForm service={s} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      <ServiceCreateForm departments={departments} />
    </div>
  );
}
