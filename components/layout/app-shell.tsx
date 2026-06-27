import type { ReactNode } from "react";

import { PrototypeBanner } from "./prototype-banner";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/**
 * App shell (06 §5): the persistent frame — prototype banner, left sidebar, top
 * bar and a constrained content area. Composed once in the root layout so every
 * route renders inside it.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <PrototypeBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
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
