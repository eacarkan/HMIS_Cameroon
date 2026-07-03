import {
  Banknote,
  BedDouble,
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { can, type Capability } from "@/lib/rbac";
import type { DashboardExtras, DashboardSummary } from "@/server/services";

/**
 * Operational patient journey (Phase 6.3 S4.2 — scope 3). The six-stage pathway
 * (Admission → Consultation → Facturation → Labo/Radio → Pharmacie → Sortie) as a
 * WORKFLOW object, not decoration: each stage carries a real capability-gated count
 * from the synthetic review data and links to its module. Where the role may not read
 * a stage's figure, the stage shows a "review workflow" link instead — never a fake
 * number. Order carries the information; connector arrows are decorative.
 */
type Stage = {
  key: string;
  icon: LucideIcon;
  /** null = role may not read it → show the review-workflow link instead. */
  value: number | null;
  href: string;
  linkCap: Capability;
};

export async function JourneyOperational({
  summary,
  extras,
  roles,
}: {
  summary: DashboardSummary;
  extras: DashboardExtras;
  roles: string[];
}) {
  const t = await getTranslations("dashboard.journey");
  const tSteps = await getTranslations("landing.journey.steps");

  const stages: Stage[] = [
    { key: "registration", icon: ClipboardList, value: summary.patientsToday, href: "/patients", linkCap: "patient.read" },
    {
      key: "consultation",
      icon: Stethoscope,
      value: summary.sections.clinical ? summary.consultationsToday : null,
      href: "/consultations",
      linkCap: "consultation.read",
    },
    {
      key: "billing",
      icon: Banknote,
      value: extras.invoicesToCollect,
      href: "/facturation",
      linkCap: "invoice.read",
    },
    { key: "diagnostics", icon: FlaskConical, value: extras.pendingDiagnostics, href: "/laboratoire", linkCap: "diagnostic.read" },
    {
      key: "pharmacy",
      icon: Pill,
      value: extras.prescriptionsToDispense,
      href: "/pharmacie/dispensation",
      linkCap: "dispense.perform",
    },
    {
      key: "discharge",
      icon: BedDouble,
      value: summary.encountersClosedToday,
      href: "/hospitalisations",
      linkCap: "admission.read",
    },
  ];

  return (
    <section
      aria-labelledby="journey-title"
      className="bg-card rounded-xl border shadow-(--shadow-card)"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="journey-title" className="text-[13px] font-bold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-[11px]">{t("caption")}</p>
      </div>
      <ol className="grid list-none grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((stage, i) => {
          const linked = can(roles, stage.linkCap);
          const inner = (
            <>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-muted-foreground text-[10px] font-bold tracking-wide"
                  aria-hidden
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <stage.icon className="text-primary size-3.5 shrink-0" aria-hidden />
                {/* connector (decorative) */}
                {i < stages.length - 1 ? (
                  <span
                    className="bg-border ml-auto hidden h-px flex-1 lg:block"
                    aria-hidden
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-[11.5px] leading-tight font-semibold">
                {tSteps(stage.key)}
              </p>
              {stage.value !== null ? (
                <p className="mt-0.5">
                  <span className="tnum text-lg font-bold tracking-tight">{stage.value}</span>{" "}
                  <span className="text-muted-foreground text-[10px]">
                    {t(`counts.${stage.key}`)}
                  </span>
                </p>
              ) : (
                <p className="text-primary mt-1 text-[10.5px] font-semibold">
                  {linked ? t("reviewWorkflow") : t("stagePrepared")}
                </p>
              )}
            </>
          );
          const cellClass = "-mt-px -ml-px block h-full border-t border-l px-3 py-2.5";
          return (
            <li key={stage.key} className="contents">
              {linked ? (
                <Link
                  href={stage.href}
                  aria-label={`${tSteps(stage.key)}${stage.value !== null ? ` : ${stage.value} ${t(`counts.${stage.key}`)}` : ""}`}
                  className={`${cellClass} hover:bg-accent focus-visible:ring-primary/40 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
                >
                  {inner}
                </Link>
              ) : (
                <div className={cellClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
