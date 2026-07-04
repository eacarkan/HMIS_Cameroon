import { getTranslations } from "next-intl/server";

/**
 * Regional hospital network grid (Phase 6.3, direction « Registre »). The eight regional
 * hospitals as a fused directory grid: flat cells, 1px separators (list carries the
 * top/left edge, each cell the right/bottom edge — robust at any column count), dotted
 * "fiche" leader lines and a small status marker. Hospital names/regions are proper names
 * (kept as-is in both languages); status labels are bilingual. Server component.
 */
const HOSPITALS = [
  { code: "HRB-DEMO", city: "Bertoua", region: "Est", active: true },
  { code: "HRE-EBO", city: "Ebolowa", region: "Sud", active: false },
  { code: "HRB-BAF", city: "Bafoussam", region: "Ouest", active: false },
  { code: "HRB-BAM", city: "Bamenda", region: "Nord-Ouest", active: false },
  { code: "HRB-BUE", city: "Buéa", region: "Sud-Ouest", active: false },
  { code: "HRG-GAR", city: "Garoua", region: "Nord", active: false },
  { code: "HRM-MAR", city: "Maroua", region: "Extrême-Nord", active: false },
  { code: "HRN-NGA", city: "Ngaoundéré", region: "Adamaoua", active: false },
] as const;

export async function HospitalNetworkGrid() {
  const t = await getTranslations("landing.network");
  return (
    // 6.4 (scope 5E) — 2 columns from the smallest screens with tighter padding, so the
    // eight hospitals read as a compact directory instead of a long mobile scroll.
    <ul className="border-border grid list-none grid-cols-2 border-t border-l lg:grid-cols-4">
      {HOSPITALS.map((h) => (
        <li
          key={h.code}
          className="bg-card border-border hover:bg-accent border-r border-b p-3.5 transition-colors sm:p-5"
        >
          <span className="bg-accent text-primary font-mono inline-block rounded-sm px-1.5 py-1 text-[10px] leading-none font-semibold tracking-wide sm:text-[11px]">
            {h.code}
          </span>
          <h3 className="font-heading mt-2.5 text-[14px] font-semibold tracking-tight sm:mt-3 sm:text-[15px]">
            {h.city}
          </h3>
          <p className="text-muted-foreground text-xs">{h.region}</p>
          <p className="mt-3 flex items-baseline gap-1.5 text-[11px] sm:mt-4">
            <span className="text-success inline-flex items-center gap-1.5 font-semibold">
              <span
                className="size-1.5 shrink-0 rounded-full bg-(--cm-green)"
                aria-hidden
              />
              {h.active ? t("statusActive") : t("statusPrepared")}
            </span>
            <span
              className="border-border grow border-b border-dotted"
              aria-hidden
            />
          </p>
        </li>
      ))}
    </ul>
  );
}
