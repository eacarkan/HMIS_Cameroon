"use client";

import { LogIn } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { ONE_CLICK_DEMO_ROLES } from "@/lib/demo-access";
import { demoLoginAction } from "@/server/auth/demo-actions";

/**
 * One-click demo-login buttons (Phase 6C). Rendered ONLY when one-click is enabled
 * (stakeholder-demo mode + flag) — the server page decides. Each button submits a form
 * bound to `demoLoginAction(roleKey)`, which re-checks the flag server-side and signs in
 * the selected SYNTHETIC account (no password crosses the client). Buttons cover the
 * seven selected roles; lab and radiology share the seeded diagnostic-technician account.
 */
export function DemoLoginButtons() {
  const t = useTranslations("demoAccess");
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ONE_CLICK_DEMO_ROLES.map((r) => (
        <form key={r.key} action={demoLoginAction.bind(null, r.key)}>
          <Button
            type="submit"
            variant="outline"
            className="w-full justify-start"
          >
            <LogIn className="size-4" aria-hidden />
            <span>
              {t("startAs")} {t(`roles.${r.key}`)}
            </span>
          </Button>
        </form>
      ))}
    </div>
  );
}
