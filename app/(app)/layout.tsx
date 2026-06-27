import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
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
  if (!actor) redirect("/connexion");

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
