import { describe, expect, it } from "vitest";

import {
  ageInYears,
  formatDateFr,
  formatDateTimeFr,
  startOfToday,
} from "@/lib/dates";

const norm = (s: string) => s.replace(/\s/gu, " ");

describe("lib/dates", () => {
  it("computes age in whole years (demo patient is 36 on 27/06/2026)", () => {
    expect(ageInYears(new Date("1990-03-14"), new Date("2026-06-27"))).toBe(36);
  });

  it("does not count this year's birthday before it occurs", () => {
    expect(ageInYears(new Date("1990-12-01"), new Date("2026-06-27"))).toBe(35);
    expect(ageInYears(new Date("2026-06-27"), new Date("2026-06-27"))).toBe(0);
  });

  it("startOfToday is midnight", () => {
    const d = startOfToday(new Date("2026-06-27T19:40:30"));
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("formats French dates JJ/MM/AAAA", () => {
    expect(formatDateFr(new Date(2026, 5, 26))).toBe("26/06/2026");
  });

  it("formats French date+time", () => {
    const out = norm(formatDateTimeFr(new Date(2026, 5, 27, 9, 40)));
    expect(out).toMatch(/^27\/06\/2026 09:40$/);
  });
});
