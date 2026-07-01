"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { DEMO_DIRECTORY } from "@/lib/demo-access";

/**
 * Public demo-account directory (Phase 6C). Lists the synthetic seeded accounts with
 * role + sign-in id + whether one-click is available. NO password is hard-coded here:
 * the shared synthetic demo password is shown from an operator-provided hint (or a
 * clearly-marked placeholder), passed in as a prop from the server page.
 */
export function DemoAccountDirectory({ passwordHint }: { passwordHint: string }) {
  const t = useTranslations("demoAccess");
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t("directoryNote")}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{t("roleColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("emailColumn")}</th>
              <th className="px-3 py-2 font-medium">{t("accessColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_DIRECTORY.map((e) => (
              <tr key={e.email} className="border-t">
                <td className="px-3 py-2">{t(`roles.${e.key}`)}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.email}</td>
                <td className="px-3 py-2">
                  {e.oneClick ? (
                    <Badge>{t("oneClickBadge")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("credentialOnly")}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("passwordLabel")} :{" "}
        <code className="text-foreground font-semibold">{passwordHint}</code>
      </p>
    </div>
  );
}
