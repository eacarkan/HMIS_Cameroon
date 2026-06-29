"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  resetUserPasswordAction,
  type AccountFormState,
} from "@/server/actions/account-actions";

const initial: AccountFormState = {};

/** A user changes their own password (current + new + confirm), policy-checked server-side. */
export function ChangePasswordForm() {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="max-w-sm space-y-3">
      <Field label={t("currentPassword")} name="currentPassword" />
      <Field label={t("newPassword")} name="newPassword" />
      <Field label={t("confirmPassword")} name="confirmPassword" />
      <p className="text-muted-foreground text-xs">{t("policyHint")}</p>
      <Button type="submit" size="sm" disabled={pending}>
        {t("changePassword")}
      </Button>
      {state.ok ? <p className="text-sm text-emerald-700">{t("passwordChanged")}</p> : null}
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/** Admin resets a user's password to a new value (policy-checked, audited). */
export function ResetPasswordForm({ userId }: { userId: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(
    resetUserPasswordAction.bind(null, userId),
    initial,
  );
  return (
    <form action={action} className="flex items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor={`reset-${userId}`} className="text-xs">
          {t("resetPassword")}
        </Label>
        <Input
          id={`reset-${userId}`}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="h-8 w-40"
          required
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("reset")}
      </Button>
      {state.ok ? <span className="text-xs text-emerald-700">{t("done")}</span> : null}
      {state.error ? <span className="text-destructive text-xs">{state.error}</span> : null}
    </form>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="password" autoComplete="off" required />
    </div>
  );
}
