import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

/**
 * Phase 2J — bilingual coverage guard. The French file is the base; the English file is a progressive
 * overlay (un-translated namespaces deliberately fall back to French). These namespaces are declared
 * FULLY bilingual — every French key MUST have an English counterpart so the new Phase 2 screens (and
 * the navigation) render correctly in English for Bamenda / Buéa. This test fails if a French key is
 * added to one of them without its English translation.
 */
const BILINGUAL_NAMESPACES = ["nav", "emergency", "queue", "admission", "diagnostic", "draft", "gate7", "serviceType", "language"] as const;

type Dict = Record<string, unknown>;

/** Collect the dotted key paths of an object (leaves only). */
function keyPaths(obj: Dict, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? keyPaths(v as Dict, path) : [path];
  });
}

describe("i18n parity (Phase 2J) — declared-bilingual namespaces", () => {
  for (const ns of BILINGUAL_NAMESPACES) {
    it(`"${ns}" has an English translation for every French key`, () => {
      const frNs = (fr as Dict)[ns] as Dict | undefined;
      const enNs = (en as Dict)[ns] as Dict | undefined;
      expect(frNs, `fr.json is missing the "${ns}" namespace`).toBeDefined();
      expect(enNs, `en.json is missing the "${ns}" namespace`).toBeDefined();
      const missing = keyPaths(frNs!).filter((p) => !keyPaths(enNs!).includes(p));
      expect(missing, `en.json "${ns}" is missing keys: ${missing.join(", ")}`).toEqual([]);
    });
  }

  it("English overlay introduces no keys absent from the French base (no orphan en keys)", () => {
    for (const ns of BILINGUAL_NAMESPACES) {
      const frNs = (fr as Dict)[ns] as Dict;
      const enNs = (en as Dict)[ns] as Dict;
      const orphan = keyPaths(enNs).filter((p) => !keyPaths(frNs).includes(p));
      expect(orphan, `en.json "${ns}" has orphan keys: ${orphan.join(", ")}`).toEqual([]);
    }
  });
});
