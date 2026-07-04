import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Reveal } from "@/components/public/reveal";

/**
 * Phase 6.5B — passive journey storytelling fail-safes. Pins the hard requirements:
 * (1) per-item reveal (`each`) is fail-OPEN — when the animation environment is absent
 * (jsdom has no IntersectionObserver, standing in for no-JS / failed hydration) no child
 * is ever opted into the hidden state; (2) the six step explanations exist in BOTH
 * languages, stay one short line, and never imply live operation, official Ministry
 * adoption, production deployment or real patient data.
 */
describe("Reveal each-mode (6.5B)", () => {
  it("never hides children when IntersectionObserver is unavailable", () => {
    render(
      <Reveal as="ol" each className="timeline">
        <li>Admission / Enregistrement</li>
        <li>Consultation</li>
      </Reveal>,
    );
    const item = screen.getByText("Admission / Enregistrement");
    expect(item).toBeInTheDocument();
    expect(item).not.toHaveAttribute("data-reveal-item");
    const list = item.closest("ol");
    expect(list).not.toBeNull();
    expect(list).not.toHaveAttribute("data-reveal");
    expect(list).toHaveClass("timeline");
  });
});

describe("journey stepDetails i18n (6.5B)", () => {
  const KEYS = [
    "registration",
    "consultation",
    "billing",
    "diagnostics",
    "pharmacy",
    "discharge",
  ];
  const load = (file: string) =>
    JSON.parse(readFileSync(join(process.cwd(), file), "utf8")).landing.journey
      .stepDetails as Record<string, string>;

  it.each(["messages/fr.json", "messages/en.json"])(
    "%s has six short, formal, safe step explanations",
    (file) => {
      const details = load(file);
      expect(Object.keys(details).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) {
        const text = details[key];
        // One short line — bounded so it cannot bloat the mobile timeline.
        expect(text.length).toBeGreaterThan(20);
        expect(text.length).toBeLessThan(80);
        // Never imply live operation / official adoption / production / real data.
        expect(text).not.toMatch(
          /production|officiel|official|données réelles|real patient|ministère|ministry|déployé|deployed/i,
        );
      }
    },
  );
});
