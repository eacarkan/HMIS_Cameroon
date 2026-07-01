import type { Metadata } from "next";

import { PublicFeedback } from "@/components/public/public-feedback";

export const metadata: Metadata = {
  title: "SantéGrid — Retours",
  description:
    "Retours des parties prenantes sur la démonstration synthétique SantéGrid — par e-mail uniquement. N'incluez aucune donnée réelle de patient.",
};

/**
 * Stakeholder feedback page (Phase 6F). Email-only instructions — NO in-app form, NO
 * database writes. The feedback email is operator-configured via NEXT_PUBLIC_FEEDBACK_EMAIL
 * (a placeholder is shown when unset).
 */
export default function RetoursPage() {
  const email = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL?.trim() || null;
  return <PublicFeedback email={email} />;
}
