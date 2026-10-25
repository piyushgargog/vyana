// packages/shared/src/health/trends.ts
// The one-line trend under a chart of device readings (steps, resting heart rate, sleep). Pure and fixed: the sentence comes
// from these templates and from numbers computed here, never from a model, and it says neither "good" nor "bad".

import { addDays } from "./dates";

export type TrendMetric = "steps" | "resting_hr" | "sleep_minutes";
export interface DayValue {
  /** `YYYY-MM-DD` */
  day: string;
  value: number;
}

export interface Trend {
  /** False when the last 7 days have fewer than 4 days with a value. */
  enough_data: boolean;
  /** Average of the last 7 days (today included) that have a value, 1 decimal. */
  current_avg: number | null;
  /** Average of the 7 days before those, same rule. */
  previous_avg: number | null;
  /** `current_avg - previous_avg`, 1 decimal; null unless both windows have at least 4 days. */
  change: number | null;
  direction: "up" | "down" | "flat" | null;
}

/** A change smaller than this is "about the same". */
const FLAT_LIMIT: Record<TrendMetric, number> = { steps: 500, resting_hr: 2, sleep_minutes: 15 };
const MIN_DAYS = 4;

const round1 = (n: number) => Math.round(n * 10) / 10;

function averageOf(values: Map<string, number>, from: string, to: string): { avg: number | null; days: number } {
  let sum = 0;
  let days = 0;
  for (const [day, value] of values) {
    if (day < from || day > to) continue;
    sum += value;
    days++;
  }
  return { avg: days === 0 ? null : sum / days, days };
}

export function computeTrend(values: DayValue[], today: string, metric: TrendMetric): Trend {
  const byDay = new Map<string, number>();
  for (const v of values) {
    if (typeof v.value !== "number" || !Number.isFinite(v.value) || v.value < 0) continue;
    byDay.set(v.day, v.value); // the last entry of a day wins
  }
  const a = averageOf(byDay, addDays(today, -6), today);
  const b = averageOf(byDay, addDays(today, -13), addDays(today, -7));
  const bothEnough = a.days >= MIN_DAYS && b.days >= MIN_DAYS;
  const rawChange = bothEnough ? (a.avg as number) - (b.avg as number) : null;
  // Direction is decided from the unrounded change: a raw change just under the flat limit can
  // round up onto it, and the rounded number is only for the words.
  const change = rawChange === null ? null : round1(rawChange);
  return {
    enough_data: a.days >= MIN_DAYS,
    current_avg: a.avg === null ? null : round1(a.avg),
    previous_avg: b.avg === null ? null : round1(b.avg),
    change,
    direction:
      rawChange === null ? null : Math.abs(rawChange) < FLAT_LIMIT[metric] ? "flat" : rawChange > 0 ? "up" : "down",
  };
}

/** `452` minutes as "7 h 32 min" (the same shape as the trend sentences). */
export function formatSleep(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return [hours > 0 ? `${hours} h` : "", mins > 0 || hours === 0 ? `${mins} min` : ""].filter(Boolean).join(" ");
}

function fmt(value: number, metric: TrendMetric): string {
  if (metric === "steps") return `${Math.round(value)} steps a day`;
  if (metric === "resting_hr") return `${Math.round(value)} beats a minute`;
  return formatSleep(value);
}

/** One of five fixed sentences. Neutral numbers only, no advice. */
export function describeTrend(trend: Trend, metric: TrendMetric): string {
  if (!trend.enough_data || trend.current_avg === null) return "Not enough days of readings yet to show a trend.";
  if (trend.change === null) return `Your average over the last 7 days is ${fmt(trend.current_avg, metric)}.`;
  if (trend.direction === "flat") return "About the same as the week before.";
  if (trend.direction === "up") return `About ${fmt(Math.abs(trend.change), metric)} more than the week before.`;
  return `About ${fmt(Math.abs(trend.change), metric)} less than the week before.`;
}
