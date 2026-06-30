"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createDiagnosticCatalogueItemAction,
  setDiagnosticCatalogueActiveAction,
  type DiagnosticFormState,
} from "@/server/actions/diagnostic-actions";

export type CatalogueRow = {
  id: string;
  code: string;
  nameFr: string;
  modality: "lab" | "radiology";
  priceLabel: string;
  isActive: boolean;
};

const initial: DiagnosticFormState = {};

/** Phase 2I — admin catalogue management: add an exam + activate/deactivate. */
export function DiagnosticCatalogueAdmin({ items }: { items: CatalogueRow[] }) {
  const t = useTranslations("diagnostic");
  const [state, action, pending] = useActionState(createDiagnosticCatalogueItemAction, initial);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, isActive: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await setDiagnosticCatalogueActiveAction(id, isActive);
      if (res?.error) setError(res.error);
    });

  return (
    <div className="space-y-6">
      <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="grid gap-1">
          <Label htmlFor="cat-code" className="text-xs">{t("code")}</Label>
          <Input id="cat-code" name="code" className="w-32" required />
        </div>
        <div className="grid flex-1 gap-1">
          <Label htmlFor="cat-name" className="text-xs">{t("nameFr")}</Label>
          <Input id="cat-name" name="nameFr" className="w-full" required />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cat-modality" className="text-xs">{t("modality")}</Label>
          <select
            id="cat-modality"
            name="modality"
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            defaultValue="lab"
          >
            <option value="lab">{t("modality_lab")}</option>
            <option value="radiology">{t("modality_radiology")}</option>
          </select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="cat-price" className="text-xs">{t("priceFcfa")}</Label>
          <Input id="cat-price" name="price" type="number" min={0} step={1} className="w-32" required />
        </div>
        <Button type="submit" size="sm" disabled={pending}>{t("addExam")}</Button>
        {state.error ? (
          <p role="alert" className="text-destructive w-full text-xs">{state.error}</p>
        ) : null}
      </form>

      {error ? <p role="alert" className="text-destructive text-xs">{error}</p> : null}

      <table className="w-full text-sm">
        <thead className="text-muted-foreground border-b text-left text-xs">
          <tr>
            <th className="p-2 font-medium">{t("code")}</th>
            <th className="p-2 font-medium">{t("nameFr")}</th>
            <th className="p-2 font-medium">{t("modality")}</th>
            <th className="p-2 font-medium">{t("price")}</th>
            <th className="p-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b last:border-0">
              <td className="tnum p-2">{it.code}</td>
              <td className="p-2">{it.nameFr}</td>
              <td className="p-2">{t(`modality_${it.modality}`)}</td>
              <td className="tnum p-2">{it.priceLabel}</td>
              <td className="p-2 text-right">
                {it.isActive ? (
                  <span className="flex items-center justify-end gap-2">
                    <Badge variant="outline">{t("active")}</Badge>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(it.id, false)}>
                      {t("deactivate")}
                    </Button>
                  </span>
                ) : (
                  <span className="flex items-center justify-end gap-2">
                    <Badge variant="secondary">{t("inactive")}</Badge>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(it.id, true)}>
                      {t("reactivate")}
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
