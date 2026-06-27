import { getTranslations } from "next-intl/server";

import { ComingSoon } from "@/components/layout/coming-soon";

export default async function JournalAuditPage() {
  const tNav = await getTranslations("nav");
  const tCs = await getTranslations("comingSoon");
  return <ComingSoon title={tNav("audit")} note={tCs("audit")} />;
}
