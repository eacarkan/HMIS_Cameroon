import { getTranslations } from "next-intl/server";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActorAndHospital } from "@/server/auth";

/**
 * My account (Phase 1A Batch 4): any authenticated user can change their own password.
 * Server-side policy + audit. No reset tokens, no SSO.
 */
export default async function MyAccountPage() {
  const { actor } = await requireActorAndHospital();
  const t = await getTranslations("account");

  return (
    <>
      <PageHeader title={t("title")} description={actor.displayName} />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">{t("changePasswordTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
