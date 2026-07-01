import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "./page-header";

/**
 * Shared empty-state for routes whose feature lands in a later build step
 * (01 §3 — menu entries shown as "à venir"). Keeps navigation coherent for the
 * demo without implying functionality that does not exist yet.
 */
export async function ComingSoon({
  title,
  note,
}: {
  title: string;
  note: string;
}) {
  const t = await getTranslations("comingSoon");

  return (
    <>
      <PageHeader title={title} />
      <Card className="border border-dashed bg-transparent ring-0">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="bg-accent text-primary grid size-12 place-items-center rounded-full">
            <Construction className="size-6" aria-hidden />
          </span>
          <Badge variant="secondary">{t("badge")}</Badge>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            {t("description")}
          </p>
          <p className="text-muted-foreground max-w-md text-sm">{note}</p>
        </CardContent>
      </Card>
    </>
  );
}
