"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "@/server/auth/actions";

const initialState: LoginState = {};

/**
 * Login form (06 §14). Submits to the `loginAction` server action (which calls
 * Auth.js sign-in → the auth service). French labels + inline error.
 */
export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("identifier")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder={t("identifierPlaceholder")}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("signingIn") : t("submit")}
      </Button>
    </form>
  );
}
