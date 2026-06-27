import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentActor } from "@/server/auth";

/**
 * Authenticated app layout (09 §6). The route guard: no session → back to the login
 * screen. The current actor is resolved server-side and handed to the shell. This is
 * convenience routing; real per-action authorization happens in the service layer.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/connexion");

  return <AppShell actor={actor}>{children}</AppShell>;
}
