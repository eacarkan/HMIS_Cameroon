import {
  Banknote,
  BedDouble,
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Reveal } from "@/components/public/reveal";

/**
 * Patient journey (Phase 6.3; 6.5B — passive storytelling). The six-stage hospital
 * journey — Registration → Consultation → Billing → Lab/Radiology → Pharmacy →
 * Hospitalization/Discharge — as an accessible ordered list. The visual order IS the
 * information (a real sequence); connectors and the rail are decorative only.
 *
 * 6.5B — mobile (< lg) renders a VERTICAL journey rail: a STATIC line connects the six
 * step badges (it never fills or animates — deliberately not a progress bar), each step
 * settles in and its badge lights up as it enters the viewport (per-step passive
 * observation via Reveal `each` — no scroll snapping, no pinning, no hijack), with a
 * short formal explanation per step (`landing.journey.stepDetails.*`, FR/EN). Without
 * JS or under reduced motion the server HTML already shows the FINAL highlighted state.
 * Desktop (lg+) keeps the sober horizontal stepper with the same capped cadence.
 * Server component, reused on /accueil and /vitrine.
 */
const STEPS = [
  { key: "registration", icon: ClipboardList },
  { key: "consultation", icon: Stethoscope },
  { key: "billing", icon: Banknote },
  { key: "diagnostics", icon: FlaskConical },
  { key: "pharmacy", icon: Pill },
  { key: "discharge", icon: BedDouble },
] as const;

export async function PatientJourneyFlow() {
  const t = await getTranslations("landing.journey");
  return (
    <Reveal
      as="ol"
      each
      className="before:bg-border relative list-none before:absolute before:top-3 before:bottom-3 before:left-[21px] before:w-px lg:grid lg:grid-cols-6 lg:before:hidden"
    >
      {STEPS.map((step, i) => (
        <li
          key={step.key}
          className="relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:px-2 lg:pb-0 lg:text-center"
        >
          {/* connector (decorative, desktop only) */}
          {i < STEPS.length - 1 ? (
            <span
              className="bg-border absolute top-[22px] left-[calc(50%+26px)] hidden h-px w-[calc(100%-52px)] lg:block"
              aria-hidden
            />
          ) : null}
          <span className="journey-badge bg-accent text-primary ring-primary/25 relative z-10 grid size-11 shrink-0 place-items-center rounded-full ring-1">
            <step.icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 pt-0.5 lg:flex lg:flex-col lg:items-center lg:pt-0">
            <span className="journey-num text-primary block text-[10px] font-semibold tracking-wider tabular-nums lg:mt-2">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-heading mt-0.5 block text-[14px] leading-snug font-semibold lg:text-[13px]">
              {t(`steps.${step.key}`)}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs leading-relaxed lg:mt-1.5 lg:max-w-[24ch]">
              {t(`stepDetails.${step.key}`)}
            </span>
          </span>
        </li>
      ))}
    </Reveal>
  );
}
