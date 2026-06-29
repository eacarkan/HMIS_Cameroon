"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPrescriptionAction,
  type PrescriptionFormState,
} from "@/server/actions/prescription-actions";

type Med = { id: string; label: string };
type Row = {
  medicationId: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
};

const initial: PrescriptionFormState = {};
const emptyRow = (medId: string): Row => ({
  medicationId: medId,
  dosage: "",
  frequency: "",
  duration: "",
  quantity: 1,
  instructions: "",
});

/** Phase 2D-2 — doctor's prescription editor. Variable-length item list submitted as JSON; the
 *  server validates each line and snapshots the medication label. No stock effect. */
export function PrescriptionEditor({
  encounterId,
  medications,
}: {
  encounterId: string;
  medications: Med[];
}) {
  const t = useTranslations("prescription");
  const [rows, setRows] = useState<Row[]>([emptyRow(medications[0]?.id ?? "")]);
  const [state, action, pending] = useActionState(
    createPrescriptionAction.bind(null, encounterId),
    initial,
  );

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, emptyRow(medications[0]?.id ?? "")]);
  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs));

  const itemsJson = JSON.stringify(
    rows.map((r) => ({ ...r, quantity: Number(r.quantity) || 0 })),
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="itemsJson" value={itemsJson} />
      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <Label className="text-xs">{t("medication")}</Label>
              <select
                aria-label={t("medication")}
                value={r.medicationId}
                onChange={(e) => update(i, { medicationId: e.target.value })}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              >
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <Field label={t("dosage")} value={r.dosage} onChange={(v) => update(i, { dosage: v })} className="lg:col-span-2" />
            <Field label={t("frequency")} value={r.frequency} onChange={(v) => update(i, { frequency: v })} className="lg:col-span-2" />
            <Field label={t("duration")} value={r.duration} onChange={(v) => update(i, { duration: v })} className="lg:col-span-2" />
            <div className="lg:col-span-1">
              <Label className="text-xs">{t("quantity")}</Label>
              <Input
                aria-label={t("quantity")}
                type="number"
                min={1}
                step={1}
                value={r.quantity}
                onChange={(e) => update(i, { quantity: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end lg:col-span-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(i)}>
                {t("removeRow")}
              </Button>
            </div>
            <div className="lg:col-span-12">
              <Field label={t("instructions")} value={r.instructions} onChange={(v) => update(i, { instructions: v })} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="presc-notes" className="text-xs">
          {t("notes")}
        </Label>
        <Input id="presc-notes" name="notes" />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          {t("addRow")}
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {t("create")}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
