import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { isPublicSiteEnabled } from "@/lib/deployment-mode";
import { getActiveHospitalContext, getCurrentActor } from "@/server/auth";
import { getAccessibleHospitals } from "@/server/services";

/**
 * Authenticated app layout (09 §5, §6). Two guards: no session → login; no active
 * hospital → hospital selector. The actor + hospital context are resolved server-side
 * and handed to the shell. This is convenience routing; real per-action authorization
 * happens in the service layer.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  // Front door: on the public stakeholder-demo deployment (HMIS_PUBLIC_SITE_ENABLED=true),
  // an unauthenticated visitor to a protected route lands on the public SantéGrid site;
  // otherwise the default sign-in behaviour is preserved (Phase 6A).
  if (!actor) redirect(isPublicSiteEnabled() ? "/accueil" : "/connexion");

  const hospital = await getActiveHospitalContext(actor);
  if (!hospital) redirect("/selection-hopital");

  const hospitals = await getAccessibleHospitals(actor);

  return (
    <AppShell
      actor={actor}
      hospital={hospital}
      hospitals={hospitals.map((h) => ({
        id: h.id,
        code: h.code,
        name: h.name,
      }))}
    >
      {children}
    </AppShell>
  );
}
