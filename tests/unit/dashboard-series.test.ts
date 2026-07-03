import { describe, expect, it } from "vitest";

import { bucketByDay, hasSeriesData } from "@/lib/dashboard-series";

/** Phase 6.3 S4 — per-day bucketing behind the dashboard sparkline. */
describe("dashboard series (Phase 6.3 S4)", () => {
  const today = new Date(2026, 6, 4, 15, 30); // local-time reference

  it("buckets timestamps into daily counts, oldest → today", () => {
    const series = bucketByDay(
      [
        new Date(2026, 6, 4, 9, 0), // today
        new Date(2026, 6, 4, 23, 59), // today (late)
        new Date(2026, 6, 3, 0, 5), // yesterday
        new Date(2026, 6, 1, 12, 0), // 3 days ago
      ],
      7,
      today,
    );
    expect(series).toHaveLength(7);
    expect(series[6]).toBe(2); // today
    expect(series[5]).toBe(1); // yesterday
    expect(series[3]).toBe(1); // 3 days ago
    expect(series.reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("ignores events outside the window (older or in the future)", () => {
    const series = bucketByDay(
      [new Date(2026, 5, 1), new Date(2026, 6, 9)],
      7,
      today,
    );
    expect(series.every((v) => v === 0)).toBe(true);
  });

  it("hasSeriesData drives the empty state", () => {
    expect(hasSeriesData([0, 0, 0])).toBe(false);
    expect(hasSeriesData([0, 1, 0])).toBe(true);
  });
});
