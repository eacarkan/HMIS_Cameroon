import type { Metadata } from "next";

import { PublicShowcase } from "@/components/public/public-showcase";

export const metadata: Metadata = {
  title: "SantéGrid — Fonctionnalités",
  description:
    "Aperçu des modules de SantéGrid (SIGH / DME) : parcours patient, facturation, pharmacie, laboratoire, urgences, hospitalisation, reporting, assurance, sécurité et supervision — sur données synthétiques.",
};

/**
 * Public feature showcase (Phase 6B). No login, read-only, synthetic — curated UI
 * preview cards + proof + readiness boundary. All content lives in the client
 * `PublicShowcase` component; this page is a thin server wrapper with metadata.
 */
export default function VitrinePage() {
  return <PublicShowcase />;
}
