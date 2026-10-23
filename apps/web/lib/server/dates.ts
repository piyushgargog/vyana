/** `YYYY-MM-DD` of a moment in India (UTC+5:30 all year, no daylight saving). */
export function istDate(d: Date): string {
  return new Date(d.getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}
