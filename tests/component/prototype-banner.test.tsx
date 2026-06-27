import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrototypeBanner } from "@/components/layout/prototype-banner";
import { PROTOTYPE_LABEL } from "@/lib/constants";

describe("PrototypeBanner", () => {
  it("renders the mandatory prototype label (R-001)", () => {
    render(<PrototypeBanner />);
    expect(screen.getByText(PROTOTYPE_LABEL)).toBeInTheDocument();
    expect(
      screen.getByText(/non destiné à la production/i),
    ).toBeInTheDocument();
  });
});
