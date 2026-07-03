/**
 * Dashboard time-series helpers (pure, client-safe) — Phase 6.3 S4.
 *
 * Buckets event timestamps into a fixed-length per-day series ending today, for the
 * hand-rolled SVG sparklines (charts rule: no chart dependency). Pure derivation over
 * dates already fetched by the hospital-scoped data-access layer — no data access here.
 */

/**
 * Bucket timestamps into `days` daily counts, oldest → today. Events outside the window
 * are ignored. `today` is injectable for tests; buckets align on local calendar days.
 */
export function bucketByDay(
  dates: readonly Date[],
  days: number,
  today: Date = new Date(),
): number[] {
  const buckets = new Array<number>(days).fill(0);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (const d of dates) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((end.getTime() - day.getTime()) / 86_400_000);
    if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
  }
  return buckets;
}

/** True when a series has at least one non-zero point (drives empty-state rendering). */
export function hasSeriesData(series: readonly number[]): boolean {
  return series.some((v) => v > 0);
}
