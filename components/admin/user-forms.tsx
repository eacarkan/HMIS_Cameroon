"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createUserAction,
  setUserActiveAction,
  assignRoleAction,
  removeRoleAction,
} from "@/server/actions/user-admin-actions";
import type { ActionState } from "@/server/actions/config-actions";

/**
 * User/account lifecycle forms (Gate 5B, client) → Gate 5B `user-admin-service` (admin-only,
 * hospital-scoped, audited). Password handling is conservative: a new user is created with a
 * clearly-labelled TEMPORARY demo password (non-production). No reset/invite/MFA/SSO.
 */
type Role = { code: string; name: string };
const initial: ActionState = {};

function FormError({ state }: { state: ActionState }) {
  const msg = state.error ?? Object.values(state.errors ?? {})[0];
  return msg ? (
    <p role="alert" className="text-destructive text-sm">
      {msg}
    </p>
  ) : null;
}

export function CreateUserForm({ roles }: { roles: Role[] }) {
  const t = useTranslations("userAdmin");
  const [state, action, pending] = useActionState(createUserAction, initial);
  return (
    <form action={action} className="mt-4 space-y-2 border-t pt-4">
      <p className="text-sm font-medium">{t("createTitle")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="u-name">{t("name")}</Label>
          <Input id="u-name" name="displayName" className="w-44" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="u-email">{t("email")}</Label>
          <Input id="u-email" name="email" type="email" className="w-56" required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="u-pwd">{t("tempPassword")}</Label>
          <Input
            id="u-pwd"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={t("tempPasswordPlaceholder")}
            className="w-44"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="u-role">{t("role")}</Label>
          <select
            id="u-role"
            name="roleCode"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          >
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {t("create")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("tempPasswordHint")}</p>
      <FormError state={state} />
    </form>
  );
}

export function UserStatusToggle({ userId, active }: { userId: string; active: boolean }) {
  const t = useTranslations("userAdmin");
  const [state, action, pending] = useActionState(
    setUserActiveAction.bind(null, userId, !active),
    initial,
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {active ? t("deactivate") : t("activate")}
        </Button>
      </form>
      <FormError state={state} />
    </div>
  );
}

export function AssignRoleForm({ userId, roles }: { userId: string; roles: Role[] }) {
  const t = useTranslations("userAdmin");
  const [, action, pending] = useActionState(assignRoleAction.bind(null, userId), initial);
  return (
    <form action={action} className="flex items-center gap-1.5">
      <select
        name="roleCode"
        aria-label={t("role")}
        className="border-input bg-background h-8 rounded-md border px-2 text-xs"
      >
        {roles.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("assignRole")}
      </Button>
    </form>
  );
}

export function RemoveRoleButton({
  userId,
  roleCode,
  roleName,
}: {
  userId: string;
  roleCode: string;
  roleName: string;
}) {
  const [state, action, pending] = useActionState(
    removeRoleAction.bind(null, userId, roleCode),
    initial,
  );
  return (
    <span className="inline-flex flex-col gap-1">
      <form action={action} className="inline">
        <button
          type="submit"
          disabled={pending}
          className="text-muted-foreground hover:text-destructive rounded border px-1.5 py-0.5 text-xs disabled:opacity-50"
          title={`Retirer : ${roleName}`}
        >
          {roleName} ✕
        </button>
      </form>
      <FormError state={state} />
    </span>
  );
}
