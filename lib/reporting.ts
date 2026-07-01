/**
 * Operational-reporting helpers (pure, client-safe) — Phase 2E.
 *
 * Period math + diagnosis Top-N. No data access, aggregate only.
 */

/** A calendar month [start, endExclusive) with a `YYYY-MM` label. `month` is 1–12. */
export function monthPeriod(year: number, month: number): { start: Date; endExclusive: Date; label: string } {
  const m = Math.min(12, Math.max(1, Math.trunc(month)));
  const start = new Date(Date.UTC(year, m - 1, 1));
  const endExclusive = new Date(Date.UTC(year, m, 1));
  const label = `${year}-${String(m).padStart(2, "0")}`;
  return { start, endExclusive, label };
}

/** Parse a `YYYY-MM` month param; returns null if malformed or out of range. */
export function parseMonthParam(param: string | null | undefined): { year: number; month: number } | null {
  if (!param) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(param.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

/** The `YYYY-MM` label for a date (used to default the period to the current month). */
export function monthLabel(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Top-N diagnosis codes by count (ICD-10 subset). Items without a code are grouped under "(sans code)". */
export function topDiagnoses(
  items: { code: string | null; label: string }[],
  n: number,
): { code: string; label: string; count: number }[] {
  const byCode = new Map<string, { code: string; label: string; count: number }>();
  for (const it of items) {
    const code = it.code?.trim() || "(sans code)";
    const row = byCode.get(code) ?? { code, label: it.label, count: 0 };
    row.count += 1;
    byCode.set(code, row);
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, n);
}
