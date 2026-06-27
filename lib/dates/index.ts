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

/** Whole years between `dob` and `now` (age). */
export function ageInYears(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}
