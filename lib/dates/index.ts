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

/** Month names in French (index 0 = janvier). */
const FR_MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Local-month [start, end) range for a year + 1-based month (1 = janvier). Phase 6.6 finance reports. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

/** A `YYYY-MM` period key (e.g. "2026-07") for a year + 1-based month. */
export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** French month label, e.g. "Juillet 2026". */
export function frMonthLabel(year: number, month: number): string {
  const name = FR_MONTHS[month - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

/** Parse a `YYYY-MM` period key → { year, month } (1-based); falls back to the current month. */
export function parsePeriod(
  period: string | undefined,
  now: Date = new Date(),
): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(period ?? "");
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Whole days between `from` and `to` (calendar, UTC-stable). Non-negative for to ≥ from. */
export function daysBetween(from: Date, to: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / MS);
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
