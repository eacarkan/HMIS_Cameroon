import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountUp } from "@/components/public/count-up";
import { Reveal } from "@/components/public/reveal";

/**
 * Phase 6.5A — motion-foundation fail-safes. These tests pin the mentor's hard
 * requirements at the component level: content is REAL and VISIBLE in the rendered
 * HTML by default, and when the animation environment is absent (no
 * IntersectionObserver — exactly the jsdom situation, standing in for no-JS /
 * failed-hydration browsers) NOTHING is ever opted into the hidden state.
 */
describe("Reveal (6.5A)", () => {
  it("renders children fully visible with no data-reveal state when IntersectionObserver is unavailable", () => {
    render(
      <Reveal as="ul" stagger className="grid">
        <li>Facturation &amp; caisse</li>
        <li>Pharmacie &amp; stock</li>
      </Reveal>,
    );
    const item = screen.getByText("Facturation & caisse");
    expect(item).toBeInTheDocument();
    const list = item.closest("ul");
    expect(list).not.toBeNull();
    // jsdom has no IntersectionObserver → the effect bails out BEFORE setting
    // data-reveal, so the CSS hidden state can never apply (fail-open, not fail-hidden).
    expect(list).not.toHaveAttribute("data-reveal");
    // The inert stagger marker may be present server-side; it selects nothing
    // without data-reveal, so it must not hide content either.
    expect(list).toHaveAttribute("data-reveal-stagger");
    expect(list).toHaveClass("grid");
  });

  it("renders the requested semantic element", () => {
    render(
      <Reveal as="section" className="cta">
        <p>Découvrir la plateforme</p>
      </Reveal>,
    );
    expect(
      screen.getByText("Découvrir la plateforme").closest("section"),
    ).not.toBeNull();
  });
});

describe("CountUp (6.5A)", () => {
  it("server-renders the FINAL value so no-JS viewers never see zero or blank", () => {
    render(<CountUp value={8} />);
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});
