// packages/shared/src/health/dates.ts
// Local calendar-day helpers for the reminder planners (pure, no I/O). Owner: Vaibhav Parmar

/**
 * Strict check for a `YYYY-MM-DD` date: the shape, a month from 1 to 12, and a day that exists in
 * that month and year (29 Feb only in a leap year). `new Date` alone rolls an out of range month or
 * day into the next month, so every helper below funnels through this check first.
 */
export function isValidLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

/**
 * `YYYY-MM-DD` as a Date at local midnight. Throws a RangeError on a malformed date instead of
 * rolling it over, so a legacy row or a direct database write can never plan a dose on a day that
 * never existed. Callers that read dates from the database guard with isValidLocalDate first and
 * skip the bad row.
 */
export function parseLocalDate(date: string): Date {
  if (!isValidLocalDate(date)) throw new RangeError("Invalid YYYY-MM-DD date");
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

/** The calendar day (`YYYY-MM-DD`) `months` months before `date`, clamped to the shorter month. */
export function monthsAgo(date: string, months: number): string {
  const d = parseLocalDate(date);
  const day = d.getDate();
  d.setDate(1); // stepping back from the 1st never rolls into the next month
  d.setMonth(d.getMonth() - months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
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

/** The India calendar day (`YYYY-MM-DD`) of a stored timestamp. India is UTC+5:30 all year (no daylight saving). */
export function istDayOf(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
