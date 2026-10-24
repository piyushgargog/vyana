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

/** India is UTC+5:30 all year (no daylight saving), so every India-time helper below shares this one offset. */
export const IST_OFFSET_MINUTES = 330;

/** The India calendar day (`YYYY-MM-DD`) of a stored timestamp. */
export function istDayOf(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

/** The moment `HH:MM` on `date` (`YYYY-MM-DD`) in India. The reverse of `istTime`. */
export function istInstant(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5))) - IST_OFFSET_MINUTES * 60 * 1000);
}

/** `HH:MM` in India for a moment. The reverse of `istInstant`. */
export function istTime(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000).toISOString().slice(11, 16);
}
