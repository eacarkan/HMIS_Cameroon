import type { ReactNode } from "react";

import type { HospitalContext } from "@/lib/hospital-context";
import type { AuthenticatedActor } from "@/server/services";
import { PrototypeBanner } from "./prototype-banner";
import { Sidebar } from "./sidebar";
import { Topbar, type HospitalOption } from "./topbar";

/**
 * App shell (06 §5): the persistent frame — prototype banner, role-filtered left
 * sidebar, top bar (active hospital + user) and a constrained content area. Composed
 * once in the authenticated (app) group.
 */
export function AppShell({
  actor,
  hospital,
  hospitals,
  children,
}: {
  actor: AuthenticatedActor;
  hospital: HospitalContext;
  hospitals: HospitalOption[];
  children: ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PrototypeBanner />
      <div className="flex min-h-0 flex-1">
        {/* Phase 3B — nav is filtered by the roles held AT the active hospital, not the
            cross-hospital union, so a multi-hospital member sees only what they may do here. */}
        <Sidebar roles={actor.rolesByHospital[hospital.hospitalId] ?? []} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar actor={actor} hospital={hospital} hospitals={hospitals} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-screen-2xl p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
