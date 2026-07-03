import { ArrowRight, Route } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Guided demo pathway (Phase 6.3F, public part). A static, link-only exploration path —
 * no tour-overlay library, no client state. The numbered list IS the recommended order,
 * so ordered-list semantics are correct here. Bilingual via `publicSite.guided.*`.
 * Reused on /accueil, /vitrine and /acces-demo.
 */
const STEPS = [
  { key: "overview", href: "/vitrine" },
  { key: "role", href: "/acces-demo" },
  { key: "patients", href: "/acces-demo" },
  { key: "billing", href: "/acces-demo" },
  { key: "pharmacy", href: "/acces-demo" },
  { key: "oversight", href: "/acces-demo" },
] as const;

export async function GuidedDemoCard() {
  const t = await getTranslations("publicSite.guided");
  return (
    <section
      aria-labelledby="guided-demo-title"
      className="border-primary/25 bg-accent/40 rounded-xl border p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <span className="bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-lg">
          <Route className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="guided-demo-title" className="font-heading text-lg font-semibold tracking-tight">
            {t("title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("body")}</p>
        </div>
      </div>
      <ol className="mt-5 grid list-none gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className="group bg-card border-border hover:border-primary/40 focus-visible:ring-ring flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-primary bg-accent grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums">
                {i + 1}
              </span>
              <span className="grow font-medium">{t(`steps.${step.key}`)}</span>
              <ArrowRight
                className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
