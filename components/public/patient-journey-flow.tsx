import {
  Banknote,
  BedDouble,
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Patient journey stepper (Phase 6.3). The six-stage hospital journey — Registration →
 * Consultation → Billing → Lab/Radiology → Pharmacy → Hospitalization/Discharge — as an
 * accessible ordered list. The visual order IS the information (a real sequence), so the
 * connector arrows are decorative only. Bilingual via `landing.journey.*`. Server component,
 * reused on /accueil and /vitrine.
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
    <ol className="grid list-none grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-6 lg:gap-y-0">
      {STEPS.map((step, i) => (
        <li key={step.key} className="relative flex flex-col items-center px-2 text-center">
          {/* connector (decorative) */}
          {i < STEPS.length - 1 ? (
            <span
              className="bg-border absolute top-[22px] left-[calc(50%+26px)] hidden h-px w-[calc(100%-52px)] lg:block"
              aria-hidden
            />
          ) : null}
          <span className="bg-accent text-primary ring-primary/15 grid size-11 shrink-0 place-items-center rounded-full ring-1">
            <step.icon className="size-5" aria-hidden />
          </span>
          <span className="text-muted-foreground mt-2 text-[10px] font-semibold tracking-wider tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="font-heading mt-0.5 text-[13px] leading-snug font-semibold">
            {t(`steps.${step.key}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
