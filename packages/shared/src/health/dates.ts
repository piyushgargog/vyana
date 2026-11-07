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

/** A strict `HH:MM` (24h) time, or null when the text is not one. `99:99`, `24:00`, `ab:cd` and `9:00` are all rejected instead of rolling over into another day or becoming Invalid Date. */
export function parseTimeOfDay(time: string): { hours: number; minutes: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** A local Date at `hh:mm` on the day `date` (`YYYY-MM-DD`). Throws on a malformed time; callers with untrusted times must check `parseTimeOfDay` first. */
export function atLocalTime(date: string, time: string): Date {
  const parsed = parseTimeOfDay(time);
  if (!parsed) throw new RangeError(`Invalid time: ${time}`);
  const d = parseLocalDate(date);
  d.setHours(parsed.hours, parsed.minutes, 0, 0);
  return d;
}

/** The India calendar day (`YYYY-MM-DD`) of a stored timestamp. India is UTC+5:30 all year (no daylight saving). */
export function istDayOf(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
