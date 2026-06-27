import { ChevronRight, Hospital as HospitalIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { OFFICIAL_HEADER } from "@/lib/constants";
import { selectHospitalAction } from "@/server/auth/actions";
import { getCurrentActor } from "@/server/auth";
import { getAccessibleHospitals } from "@/server/services";

/**
 * Hospital selection (06 §14): the accessible hospitals as selectable cards. Choosing
 * one sets the active context (audited `hospital.select`) and routes to the dashboard.
 * Outside the (app) group, so it renders without the shell but still requires a session.
 */
export default async function SelectionHopitalPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/connexion");

  const hospitals = await getAccessibleHospitals(actor);
  const t = await getTranslations("hospital");
  const tApp = await getTranslations("app");

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <PrototypeBanner />
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-6">
          <header className="space-y-1 text-center">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              {OFFICIAL_HEADER.country} · {OFFICIAL_HEADER.ministry}
            </p>
            <h1 className="text-2xl font-semibold">{t("selectTitle")}</h1>
            <p className="text-muted-foreground text-sm">
              {t("selectSubtitle")}
            </p>
          </header>

          <ul className="grid gap-3 sm:grid-cols-2">
            {hospitals.map((h) => (
              <li key={h.id}>
                <form action={selectHospitalAction.bind(null, h.id)}>
                  <button
                    type="submit"
                    className="group bg-card hover:border-primary hover:ring-primary/30 ring-foreground/5 flex w-full items-center gap-3 rounded-xl border p-4 text-left ring-1 transition"
                  >
                    <span className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-lg">
                      <HospitalIcon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {h.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {h.region} · {h.code}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-muted-foreground group-hover:text-primary size-4"
                      aria-hidden
                    />
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground text-center text-xs">
            {t("signedInAs", { name: actor.displayName })} · {tApp("name")}
          </p>
        </div>
      </main>
    </div>
  );
}
