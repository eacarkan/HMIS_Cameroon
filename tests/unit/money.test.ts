import { describe, expect, it } from "vitest";

import {
  assertFcfa,
  formatFcfa,
  isFcfa,
  lineTotalFcfa,
  sumFcfa,
} from "@/lib/money";

/** Normalize all whitespace (incl. narrow/no-break spaces) to a plain space. */
const norm = (s: string) => s.replace(/\s/gu, " ");

describe("lib/money — integer FCFA (D-009)", () => {
  it("formats 3000 as '3 000 FCFA'", () => {
    expect(norm(formatFcfa(3000))).toBe("3 000 FCFA");
  });

  it("formats the demo line amounts", () => {
    expect(norm(formatFcfa(2000))).toBe("2 000 FCFA");
    expect(norm(formatFcfa(1000))).toBe("1 000 FCFA");
    expect(norm(formatFcfa(15000))).toBe("15 000 FCFA");
    expect(norm(formatFcfa(500))).toBe("500 FCFA");
    expect(norm(formatFcfa(0))).toBe("0 FCFA");
  });

  it("never shows decimals", () => {
    expect(formatFcfa(3000)).not.toMatch(/[.,]/);
  });

  it("rejects non-integer amounts", () => {
    expect(isFcfa(3000)).toBe(true);
    expect(isFcfa(3000.5)).toBe(false);
    expect(() => assertFcfa(3000.5)).toThrow();
    expect(() => formatFcfa(3000.5)).toThrow();
  });

  it("computes line totals (unit × quantity)", () => {
    expect(lineTotalFcfa(2000, 1)).toBe(2000);
    expect(lineTotalFcfa(1000, 1)).toBe(1000);
    expect(lineTotalFcfa(1500, 3)).toBe(4500);
    expect(lineTotalFcfa(2000, 0)).toBe(0);
  });

  it("rejects negative / non-integer quantities", () => {
    expect(() => lineTotalFcfa(2000, -1)).toThrow();
    expect(() => lineTotalFcfa(2000, 1.5)).toThrow();
  });

  it("sums line items to the invoice total (3 000 FCFA)", () => {
    const lines = [lineTotalFcfa(2000, 1), lineTotalFcfa(1000, 1)];
    expect(sumFcfa(lines)).toBe(3000);
    expect(sumFcfa([])).toBe(0);
  });
});
