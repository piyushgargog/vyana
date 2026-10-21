/**
 * Pure helpers for the public share page's Health Memory Graph sections (issue #238).
 * Everything here is a function of the record the API already returned — nothing is
 * fetched, estimated or invented; dates are formatted from the stored values as they are.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-01-12" -> "12 Jan 2026". The input is an India calendar date, so it is read as written, never shifted. */
export function formatShareDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-01-12" -> "12 Jan" (chart axis labels). */
export function formatChartDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  if (!m || !d || m < 1 || m > 12) return isoDate;
  return `${d} ${MONTHS[m - 1]}`;
}

/** The India calendar date of a stored timestamp, "2026-10-08T08:00:00.000Z" -> "8 Oct". */
export function formatChartDateTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(0, 10); // a bad stored value must not take the page down
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "numeric",
  }).formatToParts(at);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!day || !month || month < 1 || month > 12) return iso.slice(0, 10);
  return `${day} ${MONTHS[month - 1]}`;
}

/**
 * The expiry countdown of the header card. Whole units only, so the text is stable
 * between the once-a-minute refreshes: "Expires in 2 d 3 h", "Expires in 5 h 12 min",
 * "Expires in 42 min"; at and past the deadline it reads "Expired".
 */
export function expiryCountdown(expiresAt: string, now: Date): { expired: boolean; text: string } {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return { expired: true, text: "Expired" };
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return { expired: false, text: `Expires in ${mins} min` };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { expired: false, text: `Expires in ${hours} h ${mins % 60} min` };
  const days = Math.floor(hours / 24);
  return { expired: false, text: `Expires in ${days} d ${hours % 24} h` };
}

export type AdherenceDayState = "taken" | "missed" | "skipped" | "none";

/**
 * One square of the adherence strip. A day with a missed dose reads as missed, and a day with a skipped dose reads as
 * skipped, even if other doses were taken: the strip never paints a partly-kept day as fully kept ("taken" means
 * every logged dose of the day was taken).
 */
export function adherenceDayState(day: { taken: number; missed: number; skipped: number }): AdherenceDayState {
  if (day.missed > 0) return "missed";
  if (day.skipped > 0) return "skipped";
  if (day.taken > 0) return "taken";
  return "none";
}

/** The strip's totals line: plain sums of the days the record carries. */
export function adherenceTotals(days: { taken: number; missed: number; skipped: number }[]): {
  taken: number;
  missed: number;
  skipped: number;
} {
  return days.reduce(
    (acc, d) => ({ taken: acc.taken + d.taken, missed: acc.missed + d.missed, skipped: acc.skipped + d.skipped }),
    { taken: 0, missed: 0, skipped: 0 },
  );
}

/**
 * The shared time scale of the medicines bars: from the earliest start to the latest
 * end, with a medicine that has no end running to today. Null when there is nothing
 * to place (no medicines).
 */
export function medicineScale(
  medicines: { start: string; end: string | null }[],
  today: string,
): { startMs: number; endMs: number } | null {
  if (medicines.length === 0) return null;
  const dayMs = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();
  let startMs = Number.POSITIVE_INFINITY;
  let endMs = Number.NEGATIVE_INFINITY;
  for (const med of medicines) {
    startMs = Math.min(startMs, dayMs(med.start));
    endMs = Math.max(endMs, dayMs(med.end ?? today));
  }
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null; // an invalid stored date: draw nothing, never NaN
  if (endMs <= startMs) endMs = startMs + 24 * 60 * 60 * 1000;
  return { startMs, endMs };
}

/** "blood_pressure" -> "Blood pressure": the stored vital type, written out for the page. */
export function vitalTitle(type: string): string {
  const words = type.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : type;
}

/** The stored lab flag as the page writes it. "unknown" and anything else read as no flag. */
export function flagText(flag: "low" | "normal" | "high" | "unknown"): string {
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  if (flag === "normal") return "Normal";
  return "";
}
