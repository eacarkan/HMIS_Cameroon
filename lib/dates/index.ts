/**
 * Dates — French formatting helpers (09 §9, design system §10).
 *
 * Consistent French date display across tables, banners and the receipt
 * (e.g. `26/06/2026`, `27/06/2026 09:40`). Pure functions, no side effects.
 */

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const FR_DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format a date as `JJ/MM/AAAA`, e.g. "26/06/2026". */
export function formatDateFr(value: Date): string {
  return FR_DATE.format(value);
}

/** Format a date+time as `JJ/MM/AAAA HH:MM`, e.g. "27/06/2026 09:40". */
export function formatDateTimeFr(value: Date): string {
  return FR_DATE_TIME.format(value).replace(", ", " ");
}

/** Midnight (local) at the start of today — for "today" KPI windows. */
export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Today's local date as `YYYY-MM-DD` (default for the cashier daily report). */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Local-day [start, end) range for a `YYYY-MM-DD` date string. */
export function dayRange(isoDate: string): { start: Date; end: Date } {
  const start = new Date(`${isoDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Whole years between `dob` and `now` (age). Uses UTC calendar fields so the result is timezone-stable
 * — a date of birth is a calendar date, and age banding (Phase 2E aggregate reports) must not shift with
 * the server's local timezone.
 */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}
