// packages/shared/src/health/dates.ts
// Local calendar-day helpers for the reminder planners (pure, no I/O). Owner: Vaibhav Parmar

/** `YYYY-MM-DD` as a Date at local midnight. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** A Date as `YYYY-MM-DD` in local time. */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** `date` plus `days` calendar days (negative goes back), as `YYYY-MM-DD`. */
export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

/** The calendar day (`YYYY-MM-DD`) `months` months before `date`. */
export function monthsAgo(date: string, months: number): string {
  const d = parseLocalDate(date);
  d.setMonth(d.getMonth() - months);
  return formatLocalDate(d);
}

/** Whole calendar days from `from` to `to` (`to` later gives a positive number). */
export function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** A local Date at `hh:mm` on the day `date` (`YYYY-MM-DD`). */
export function atLocalTime(date: string, time: string): Date {
  const d = parseLocalDate(date);
  d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0);
  return d;
}
