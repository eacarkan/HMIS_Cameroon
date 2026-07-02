import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { DashboardKpis } from "@/components/dashboard/dashboard-kpis";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { DashboardSummary } from "@/server/services";

/**
 * Phase 6.2C regression — the dashboard KPI body must render in English when English is the
 * active locale. Uses the SAME merge the app uses (French base + English overlay) so this
 * mirrors production, and asserts no French dashboard UI labels leak through.
 */
type Dict = Record<string, unknown>;
function deepMerge(base: Dict, overlay: Dict): Dict {
  const out: Dict = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    const cur = out[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object") {
      out[k] = deepMerge(cur as Dict, v as Dict);
    } else out[k] = v;
  }
  return out;
}
const enMerged = deepMerge(fr as Dict, en as Dict);

const summary: DashboardSummary = {
  sections: { activity: true, clinical: true, billing: true, management: true },
  patientsToday: 3,
  openEncounters: 2,
  encountersOpenedToday: 4,
  encountersClosedToday: 1,
  consultationsToday: 5,
  invoicesToday: 6,
  collectionsToday: 30000,
  byMethod: [
    { method: "cash", methodLabel: "espèces", total: 20000, count: 2 },
    { method: "mobile_money", methodLabel: "mobile money", total: 10000, count: 1 },
  ],
  recent: [],
};

const FRENCH_UI_TERMS = [
  "Activité du jour",
  "Activité clinique",
  "Facturation & caisse",
  "Patients enregistrés",
  "Visites ouvertes",
  "Consultations du jour",
  "Encaissements du jour",
  "Espèces",
  "Mobile money", // FR value is "Mobile money" too — but EN is "Mobile money"; kept out of list
].filter((t) => t !== "Mobile money");

describe("Phase 6.2C — dashboard KPIs render in English", () => {
  it("shows English section + KPI + payment labels, with no French UI terms", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={enMerged}>
        <DashboardKpis summary={summary} />
      </NextIntlClientProvider>,
    );
    const text = container.textContent ?? "";

    // Positive: English labels present.
    for (const label of [
      "Today's activity",
      "Patients registered today",
      "Open visits",
      "Clinical activity",
      "Billing & cashiering",
      "Collections today",
      "Cash",
    ]) {
      expect(text, `missing English label: ${label}`).toContain(label);
    }

    // Negative: no French UI terms.
    for (const term of FRENCH_UI_TERMS) {
      expect(text, `French UI term leaked: ${term}`).not.toContain(term);
    }
  });
});
