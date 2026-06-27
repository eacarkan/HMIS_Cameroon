import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";

export default async function AdministrationPage() {
  const tNav = await getTranslations("nav");
  const tCs = await getTranslations("comingSoon");
  return (
    <ComingSoon title={tNav("administration")} note={tCs("administration")} />
  );
}
