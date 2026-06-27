import { describe, expect, it } from "vitest";

import { formatDocumentNumber } from "@/lib/numbering";

describe("lib/numbering — deterministic document numbers (05 §6)", () => {
  const base = { hospitalCode: "HRB-DEMO", year: 2026, counter: 1 } as const;

  it("formats the demo numbers (P/V/F/R)", () => {
    expect(formatDocumentNumber({ ...base, kind: "patient" })).toBe(
      "HRB-DEMO-P-2026-000001",
    );
    expect(formatDocumentNumber({ ...base, kind: "encounter" })).toBe(
      "HRB-DEMO-V-2026-000001",
    );
    expect(formatDocumentNumber({ ...base, kind: "invoice" })).toBe(
      "HRB-DEMO-F-2026-000001",
    );
    expect(formatDocumentNumber({ ...base, kind: "receipt" })).toBe(
      "HRB-DEMO-R-2026-000001",
    );
  });

  it("zero-pads the counter to 6 digits", () => {
    expect(
      formatDocumentNumber({ ...base, kind: "patient", counter: 42 }),
    ).toBe("HRB-DEMO-P-2026-000042");
    expect(
      formatDocumentNumber({ ...base, kind: "patient", counter: 123456 }),
    ).toBe("HRB-DEMO-P-2026-123456");
  });

  it("respects the hospital code and year", () => {
    expect(
      formatDocumentNumber({
        hospitalCode: "HRN-NGA",
        kind: "patient",
        year: 2027,
        counter: 7,
      }),
    ).toBe("HRN-NGA-P-2027-000007");
  });

  it("rejects an invalid counter", () => {
    expect(() =>
      formatDocumentNumber({ ...base, kind: "patient", counter: -1 }),
    ).toThrow();
  });
});
