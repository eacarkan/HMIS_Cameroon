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
    <ul className="border-border grid list-none grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-4">
      {HOSPITALS.map((h) => (
        <li
          key={h.code}
          className="bg-card border-border hover:bg-accent border-r border-b p-5 transition-colors"
        >
          <span className="bg-accent text-primary font-mono inline-block rounded-sm px-1.5 py-1 text-[11px] leading-none font-semibold tracking-wide">
            {h.code}
          </span>
          <h3 className="font-heading mt-3 text-[15px] font-semibold tracking-tight">
            {h.city}
          </h3>
          <p className="text-muted-foreground text-xs">{h.region}</p>
          <p className="mt-4 flex items-baseline gap-1.5 text-[11px]">
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
