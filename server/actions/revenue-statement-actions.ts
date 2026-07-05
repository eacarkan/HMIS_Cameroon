"use server";

import { redirect } from "next/navigation";

import { requireActorAndHospital } from "@/server/auth";
import { generateRevenueStatementNumber } from "@/server/services";

/**
 * Phase 6.6 · Unit 5 — assign a numbered monthly revenue statement id (audited) then show the printable
 * document. The service enforces RBAC + audit; this action only carries the period and redirects.
 */
export async function generateStatementAction(period: string, _formData: FormData): Promise<void> {
  const { actor, hospital } = await requireActorAndHospital();
  const { number, period: resolved } = await generateRevenueStatementNumber(actor, hospital, { period });
  redirect(`/facturation/etat-recettes?period=${resolved}&number=${encodeURIComponent(number)}`);
}
