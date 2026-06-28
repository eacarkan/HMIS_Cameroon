"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { codeLabelFr } from "@/lib/constants";
import {
  addObservationAction,
  addDiagnosisAction,
} from "@/server/actions/clinical-structure-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * Structured clinical panel for a consultation (Gate 4, 25 §8). Clinician-only mutation
 * via server actions → Gate 3 clinical-structure-service (RBAC + scoping + audit). The
 * free-text consultation fields stay as they are (dual-run). No prescription, no
 * finalization/amendment workflow, no Practitioner.
 */
type Observation = { id: string; type: string; value: string; unit: string | null };
type Diagnosis = { id: string; label: string; code: string | null; isPrimary: boolean };

const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function ClinicalStructurePanel({
  encounterId,
  consultationId,
  observations,
  diagnoses,
  canManage,
}: {
  encounterId: string;
  consultationId: string;
  observations: Observation[];
  diagnoses: Diagnosis[];
  canManage: boolean;
}) {
  const t = useTranslations("clinical");
  const [obsState, obsAction, obsPending] = useActionState(
    addObservationAction.bind(null, encounterId, consultationId),
    initial,
  );
  const [dxState, dxAction, dxPending] = useActionState(
    addDiagnosisAction.bind(null, encounterId, consultationId),
    initial,
  );

  return (
    <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2">
      {/* Observations / vitals */}
      <div>
        <h4 className="mb-1.5 text-xs font-medium">{t("observations")}</h4>
        {observations.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t("noObservations")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {observations.map((o) => (
              <li key={o.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{codeLabelFr(o.type)}</span>
                <span className="font-medium">
                  {o.value}
                  {o.unit ? ` ${o.unit}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form action={obsAction} className="mt-2 flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="obs-type" className="text-xs">
                {t("obsType")}
              </Label>
              <Input id="obs-type" name="type" className="h-8 w-28" required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="obs-value" className="text-xs">
                {t("obsValue")}
              </Label>
              <Input id="obs-value" name="value" className="h-8 w-20" required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="obs-unit" className="text-xs">
                {t("obsUnit")}
              </Label>
              <Input id="obs-unit" name="unit" className="h-8 w-16" />
            </div>
            <Button type="submit" size="sm" disabled={obsPending}>
              {t("addObservation")}
            </Button>
            <FormError state={obsState} />
          </form>
        ) : null}
      </div>

      {/* Diagnoses */}
      <div>
        <h4 className="mb-1.5 text-xs font-medium">{t("diagnoses")}</h4>
        {diagnoses.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t("noDiagnoses")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {diagnoses.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {d.label}
                  {d.code ? <span className="text-muted-foreground"> · {d.code}</span> : null}
                </span>
                {d.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form action={dxAction} className="mt-2 flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="dx-label" className="text-xs">
                {t("diagLabel")}
              </Label>
              <Input id="dx-label" name="label" className="h-8 w-40" required />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="dx-code" className="text-xs">
                {t("diagCode")}
              </Label>
              <Input id="dx-code" name="code" className="h-8 w-24" />
            </div>
            <Button type="submit" size="sm" disabled={dxPending}>
              {t("addDiagnosis")}
            </Button>
            <FormError state={dxState} />
          </form>
        ) : null}
      </div>
    </div>
  );
}
