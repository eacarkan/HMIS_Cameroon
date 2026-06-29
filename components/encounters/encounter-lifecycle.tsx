"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignEncounterServiceAction,
  changeEncounterStatusAction,
  type EncounterFormState,
} from "@/server/actions/encounter-actions";

const initial: EncounterFormState = {};

/**
 * Encounter status controls (Phase 1A Batch 1B). Close/cancel an open encounter; terminal
 * states show no controls. Invalid transitions are rejected server-side — any error message
 * is surfaced here. The control is convenience; the service is the authority.
 */
export function EncounterStatusControls({
  encounterId,
  status,
}: {
  encounterId: string;
  status: "open" | "closed" | "cancelled";
}) {
  const t = useTranslations("encounter");
  const [closeState, closeAction, closing] = useActionState(
    changeEncounterStatusAction.bind(null, encounterId, "closed"),
    initial,
  );
  const [cancelState, cancelAction, cancelling] = useActionState(
    changeEncounterStatusAction.bind(null, encounterId, "cancelled"),
    initial,
  );

  if (status !== "open") {
    return <p className="text-muted-foreground text-sm">{t("lifecycleTerminal")}</p>;
  }

  const err = closeState.error ?? cancelState.error;
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <form action={closeAction}>
          <Button type="submit" size="sm" disabled={closing}>
            {t("closeEncounter")}
          </Button>
        </form>
        <form action={cancelAction}>
          <Button type="submit" size="sm" variant="outline" disabled={cancelling}>
            {t("cancelEncounter")}
          </Button>
        </form>
      </div>
      {err ? (
        <p role="alert" className="text-destructive text-sm">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/** Assign / re-route the encounter's service or department (recorded + audited). */
export function EncounterServiceForm({
  encounterId,
  current,
}: {
  encounterId: string;
  current: string;
}) {
  const t = useTranslations("encounter");
  const [state, action, pending] = useActionState(
    assignEncounterServiceAction.bind(null, encounterId),
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-1.5">
        <Label htmlFor="enc-service">{t("assignService")}</Label>
        <Input id="enc-service" name="serviceLabel" defaultValue={current} required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {t("assign")}
      </Button>
      {state.error ?? state.errors?.serviceLabel ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error ?? state.errors?.serviceLabel}
        </p>
      ) : null}
    </form>
  );
}
