"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignWardAction,
  authorizeDischargeAction,
  cancelAdmissionAction,
  generateDailyChargeAction,
  requestAdmissionAction,
  requestDischargeAction,
  type AdmissionFormState,
} from "@/server/actions/hospitalization-actions";

export type AdmissionStatusCode =
  | "requested"
  | "admitted"
  | "discharge_requested"
  | "discharged"
  | "cancelled";

export type AdmissionView = {
  id: string;
  admissionNumber: string;
  status: AdmissionStatusCode;
  reason: string;
  wardName: string | null;
  dailyWardFeeLabel: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceTotalLabel: string | null;
  dailyChargeCount: number;
  cancelReason: string | null;
};

const initial: AdmissionFormState = {};

const STATUS_VARIANT: Record<AdmissionStatusCode, "secondary" | "default" | "destructive" | "outline"> = {
  requested: "secondary",
  admitted: "default",
  discharge_requested: "secondary",
  discharged: "outline",
  cancelled: "destructive",
};

export function AdmissionControls({
  encounterId,
  admission,
  wards,
  dischargeBlock,
  caps,
}: {
  encounterId: string;
  admission: AdmissionView | null;
  wards: { id: string; name: string }[];
  dischargeBlock: { blocked: boolean; reasons: string[] };
  caps: { request: boolean; assign: boolean; discharge: boolean; fee: boolean };
}) {
  const t = useTranslations("admission");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<AdmissionFormState>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
    });

  // No admission yet — offer the doctor the request form.
  if (!admission) {
    if (!caps.request) {
      return <p className="text-muted-foreground text-sm">{t("none")}</p>;
    }
    return <RequestForm encounterId={encounterId} />;
  }

  const isActive = admission.status === "admitted" || admission.status === "discharge_requested";

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tnum font-medium">{admission.admissionNumber}</span>
        <Badge variant={STATUS_VARIANT[admission.status]}>{t(`status_${admission.status}`)}</Badge>
        {admission.wardName ? (
          <span className="text-muted-foreground">
            {t("ward")}: {admission.wardName}
          </span>
        ) : null}
      </div>

      <div>
        <span className="text-muted-foreground">{t("reason")}: </span>
        {admission.reason}
      </div>

      {admission.dailyWardFeeLabel ? (
        <div>
          <span className="text-muted-foreground">{t("dailyFee")}: </span>
          <span className="font-medium">{admission.dailyWardFeeLabel}</span>
        </div>
      ) : null}

      {admission.invoiceNumber ? (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{t("invoice")}: </span>
          <Link href={`/factures/${admission.invoiceId}`} className="hover:text-primary tnum font-medium">
            {admission.invoiceNumber}
          </Link>
          {admission.invoiceTotalLabel ? <span className="tnum">{admission.invoiceTotalLabel}</span> : null}
          <span className="text-muted-foreground text-xs">
            ({admission.dailyChargeCount} {t("days")})
          </span>
        </div>
      ) : null}

      {admission.status === "cancelled" && admission.cancelReason ? (
        <p className="text-muted-foreground text-xs">
          {t("cancelReason")}: {admission.cancelReason}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}

      {/* Ward assignment + cancel — only while requested. */}
      {admission.status === "requested" ? (
        <div className="space-y-2 border-t pt-2">
          {caps.assign ? <AssignForm encounterId={encounterId} admissionId={admission.id} wards={wards} /> : null}
          {caps.request ? <CancelForm encounterId={encounterId} admissionId={admission.id} /> : null}
        </div>
      ) : null}

      {/* Daily fee + discharge — while admitted / discharge requested. */}
      {isActive ? (
        <div className="space-y-2 border-t pt-2">
          {caps.fee ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => generateDailyChargeAction(encounterId, admission.id))}
            >
              {t("chargeDailyFee")}
            </Button>
          ) : null}

          {dischargeBlock.blocked ? (
            <p className="text-destructive text-xs" role="status">
              {t("dischargeBlocked")}: {dischargeBlock.reasons.join(" ; ")}
            </p>
          ) : null}

          {caps.discharge ? (
            <div className="flex flex-wrap gap-2">
              {admission.status === "admitted" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => requestDischargeAction(encounterId, admission.id))}
                >
                  {t("requestDischarge")}
                </Button>
              ) : null}
              <Button
                size="sm"
                disabled={pending || dischargeBlock.blocked}
                onClick={() => run(() => authorizeDischargeAction(encounterId, admission.id))}
              >
                {t("authorizeDischarge")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RequestForm({ encounterId }: { encounterId: string }) {
  const t = useTranslations("admission");
  const [state, action, pending] = useActionState(requestAdmissionAction.bind(null, encounterId), initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="grid flex-1 gap-1">
        <Label htmlFor="adm-reason" className="text-xs">
          {t("reason")}
        </Label>
        <Input id="adm-reason" name="reason" className="w-full" required />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("requestAdmission")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function AssignForm({
  encounterId,
  admissionId,
  wards,
}: {
  encounterId: string;
  admissionId: string;
  wards: { id: string; name: string }[];
}) {
  const t = useTranslations("admission");
  const [state, action, pending] = useActionState(
    assignWardAction.bind(null, encounterId, admissionId),
    initial,
  );
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="adm-ward" className="text-xs">
          {t("ward")}
        </Label>
        <select
          id="adm-ward"
          name="wardServiceUnitId"
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          defaultValue=""
          required
        >
          <option value="" disabled>
            {t("selectWard")}
          </option>
          {wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {t("assignWard")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-xs">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function CancelForm({ encounterId, admissionId }: { encounterId: string; admissionId: string }) {
  const t = useTranslations("admission");
  const [state, action, pending] = useActionState(
    cancelAdmissionAction.bind(null, encounterId, admissionId),
    initial,
  );
  return (
    <form action={action} className="flex items-end gap-1">
      <Input name="reason" placeholder={t("cancelReasonPlaceholder")} className="h-8 w-56 text-xs" required />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {t("cancel")}
      </Button>
      {state.error ? (
        <span role="alert" className="text-destructive text-xs">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
