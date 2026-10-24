// packages/shared/src/health/activity.ts
// The view models of the wearables screens (issue #328, ADR-073): the Activity card of the
// Today tab / dashboard and the charts of the health trends screen. Pure functions of the
// stored rows, so the card, the screen and their tests all read the same numbers.
//
// The row shapes are the ones of the device data layer (issue #325): one `daily_activity`
// row per patient, day and source, and spot readings stored as vitals with a `source` that
// is not "manual". Every value keeps the device it came from ("from <device>").
// A device reading is never a diagnosis: nothing here flags a reading as high, low, good or
// bad, and the only sentences are the fixed ones of `describeTrend` (trends.ts).

import { addDays, istDayOf } from "./dates";
import { computeTrend, describeTrend, formatSleep, type DayValue } from "./trends";

/** The fixed line under the SpO2, blood pressure and glucose charts (ADR-073). */
export const TREND_DEVICE_NOTE = "A device reading is not a medical test.";

/** One row of `daily_activity` as the data layer returns it (issue #325). */
export interface DailyActivityRow {
  /** `YYYY-MM-DD` */
  day: string;
  steps: number | null;
  sleep_minutes: number | null;
  resting_hr: number | null;
  /** `health_connect`, `healthkit` or `ble` for device rows. */
  source: string;
  device_name: string | null;
}

/** One spot reading stored by the sync engine as a vital (issue #325). */
export interface DeviceSpotReading {
  /** The vitals type: `spo2`, `bp`, `sugar_fasting`, `sugar_random`, `weight`, `heart_rate`. */
  type: string;
  value: number;
  /** Blood pressure only: the diastolic number. */
  value2: number | null;
  unit: string;
  /** ISO timestamp of the reading. */
  measured_at: string;
  source: string;
  device_name: string | null;
}

/**
 * The words after "from" for a reading: the device's own name when the row carries one,
 * otherwise the store it came through (the names of ADR-073), otherwise just "device".
 */
export function sourceLabel(source: string, deviceName: string | null): string {
  const name = deviceName?.trim();
  if (name) return name;
  if (source === "health_connect") return "Health Connect";
  if (source === "healthkit") return "HealthKit";
  return "device";
}

/** One value of a day, with the device it came from. */
export interface SourcedValue {
  value: number;
  from: string;
}

export interface MergedDay {
  day: string;
  steps: SourcedValue | null;
  sleep_minutes: SourcedValue | null;
  resting_hr: SourcedValue | null;
}

/**
 * One entry per day, oldest first. A day can carry one row per source; for each field the
 * last row (in the order given) that holds a value wins, with that row's device — the same
 * "last entry of a day wins" rule `computeTrend` applies. Rows after `today` are dropped.
 */
export function mergeActivityDays(rows: DailyActivityRow[], today: string): MergedDay[] {
  const byDay = new Map<string, MergedDay>();
  for (const row of rows) {
    if (row.day > today) continue;
    const day = byDay.get(row.day) ?? { day: row.day, steps: null, sleep_minutes: null, resting_hr: null };
    const from = sourceLabel(row.source, row.device_name);
    if (row.steps !== null) day.steps = { value: row.steps, from };
    if (row.sleep_minutes !== null) day.sleep_minutes = { value: row.sleep_minutes, from };
    if (row.resting_hr !== null) day.resting_hr = { value: row.resting_hr, from };
    byDay.set(row.day, day);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

export interface ActivityCardModel {
  /** False when there is nothing to show: the screens render their empty state instead. */
  has_data: boolean;
  /** Today's steps. `fill` is the ring's fraction of the goal; null when there is no goal, so the ring makes no fill claim. */
  steps: { value: number; from: string; goal: number | null; fill: number | null } | null;
  /**
   * The latest resting heart rate (today's when there is one, else the newest of the last
   * 7 days). `average_7d` and `arrow` are set only when at least 4 of the last 7 days have
   * a reading — the gate of `computeTrend` — and the arrow compares the value with that
   * average. It is a plain direction, never a judgement: no colour hangs on it.
   */
  resting_hr: {
    value: number;
    from: string;
    day: string;
    average_7d: number | null;
    arrow: "up" | "down" | "same" | null;
  } | null;
  /** Last night's sleep: today's row (the night that ended this morning), else yesterday's. */
  sleep: { minutes: number; text: string; from: string; day: string } | null;
}

export function buildActivityCard(rows: DailyActivityRow[], today: string, stepGoal: number | null): ActivityCardModel {
  const days = mergeActivityDays(rows, today);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const todays = byDay.get(today);

  const goal = stepGoal !== null && stepGoal > 0 ? stepGoal : null;
  const steps = todays?.steps
    ? {
        value: todays.steps.value,
        from: todays.steps.from,
        goal,
        fill: goal ? Math.min(1, Math.max(0, todays.steps.value / goal)) : null,
      }
    : null;

  const hrTrend = computeTrend(
    days.flatMap((d): DayValue[] => (d.resting_hr ? [{ day: d.day, value: d.resting_hr.value }] : [])),
    today,
    "resting_hr",
  );
  const recentHr = [...days].reverse().find((d) => d.day >= addDays(today, -6) && d.resting_hr);
  const resting_hr = recentHr?.resting_hr
    ? {
        value: recentHr.resting_hr.value,
        from: recentHr.resting_hr.from,
        day: recentHr.day,
        average_7d: hrTrend.enough_data ? hrTrend.current_avg : null,
        arrow: (hrTrend.enough_data && hrTrend.current_avg !== null
          ? recentHr.resting_hr.value > hrTrend.current_avg
            ? "up"
            : recentHr.resting_hr.value < hrTrend.current_avg
              ? "down"
              : "same"
          : null) as "up" | "down" | "same" | null,
      }
    : null;

  const yesterday = byDay.get(addDays(today, -1));
  const sleepDay = todays?.sleep_minutes ? todays : yesterday?.sleep_minutes ? yesterday : undefined;
  const sleep = sleepDay?.sleep_minutes
    ? { minutes: sleepDay.sleep_minutes.value, text: formatSleep(sleepDay.sleep_minutes.value), from: sleepDay.sleep_minutes.from, day: sleepDay.day }
    : null;

  return { has_data: days.length > 0, steps, resting_hr, sleep };
}

export type TrendRangeDays = 7 | 30 | 90;

export type TrendMetricKey = "steps" | "resting_hr" | "sleep" | "spo2" | "bp" | "glucose" | "weight" | "heart_rate";

export interface TrendChartPoint {
  /** `YYYY-MM-DD` (the day in India for a spot reading). */
  day: string;
  value: number;
}

export interface TrendChartModel {
  metric: TrendMetricKey;
  title: string;
  unit: string;
  points: TrendChartPoint[];
  /** Blood pressure only: the diastolic line, aligned with `points`; a null entry is a gap. */
  points2: (TrendChartPoint | null)[] | null;
  /**
   * The sentence under the chart. Only steps, resting heart rate and sleep have one, and it
   * is always the fixed sentence of `describeTrend` — never written here. Null otherwise:
   * the other charts show their numbers only.
   */
  sentence: string | null;
  /** The fixed not-a-medical-test line, set for SpO2, blood pressure and glucose only. */
  note: string | null;
  /** The latest reading of the chart, as the list under it shows it. */
  latest: { text: string; day: string; at: string | null; from: string } | null;
  /** The screen-reader label of the chart, e.g. "Steps, last 7 days, average 7000 steps". */
  label: string;
}

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

function dailyChart(
  metric: "steps" | "resting_hr" | "sleep",
  title: string,
  unit: string,
  days: MergedDay[],
  range: TrendRangeDays,
  today: string,
): TrendChartModel | null {
  const from = addDays(today, -(range - 1));
  const inRange = days.filter((d) => d.day >= from);
  const pick = (d: MergedDay) => (metric === "steps" ? d.steps : metric === "resting_hr" ? d.resting_hr : d.sleep_minutes);
  const points = inRange.flatMap((d) => {
    const v = pick(d);
    return v ? [{ day: d.day, value: v.value }] : [];
  });
  if (points.length === 0) return null;

  const all = days.flatMap((d) => {
    const v = pick(d);
    return v ? [{ day: d.day, value: v.value }] : [];
  });
  const trendMetric = metric === "sleep" ? "sleep_minutes" : metric;
  const sentence = describeTrend(computeTrend(all, today, trendMetric), trendMetric);

  const avg = average(points.map((p) => p.value));
  const avgText =
    metric === "sleep" ? formatSleep(avg ?? 0) : `${Math.round(avg ?? 0)}${metric === "steps" ? " steps" : " bpm"}`;
  const latestDay = [...inRange].reverse().find((d) => pick(d));
  const latestValue = latestDay ? pick(latestDay) : null;
  return {
    metric,
    title,
    unit,
    points,
    points2: null,
    sentence,
    note: null,
    latest: latestValue
      ? {
          text:
            metric === "sleep"
              ? formatSleep(latestValue.value)
              : metric === "steps"
                ? `${latestValue.value} steps`
                : `${latestValue.value} bpm`,
          day: latestDay!.day,
          at: null,
          from: latestValue.from,
        }
      : null,
    label: `${title}, last ${range} days, average ${avgText}`,
  };
}

const SPOT_TYPES: Record<string, TrendMetricKey> = {
  spo2: "spo2",
  bp: "bp",
  sugar_fasting: "glucose",
  sugar_random: "glucose",
  weight: "weight",
  heart_rate: "heart_rate",
};

const SPOT_TITLES: Record<TrendMetricKey, string> = {
  steps: "Steps",
  resting_hr: "Resting heart rate",
  sleep: "Sleep",
  spo2: "SpO2",
  bp: "Blood pressure",
  glucose: "Glucose",
  weight: "Weight",
  heart_rate: "Heart rate",
};

function spotChart(
  metric: TrendMetricKey,
  readings: DeviceSpotReading[],
  range: TrendRangeDays,
  today: string,
): TrendChartModel | null {
  const from = addDays(today, -(range - 1));
  const inRange = readings
    .filter((r) => SPOT_TYPES[r.type] === metric)
    .map((r) => ({ reading: r, day: istDayOf(r.measured_at) }))
    .filter((e) => e.day >= from && e.day <= today)
    .sort((a, b) => (a.reading.measured_at < b.reading.measured_at ? -1 : a.reading.measured_at > b.reading.measured_at ? 1 : 0));
  if (inRange.length === 0) return null;

  const points = inRange.map((e) => ({ day: e.day, value: e.reading.value }));
  const points2 =
    metric === "bp"
      ? inRange.map((e) => (e.reading.value2 !== null ? { day: e.day, value: e.reading.value2 } : null))
      : null;
  const unit = inRange[inRange.length - 1].reading.unit;
  const avg = average(points.map((p) => p.value));
  const last = inRange[inRange.length - 1];
  const kind = last.reading.type === "sugar_fasting" ? "fasting" : last.reading.type === "sugar_random" ? "random" : null;
  const latestText =
    metric === "bp" && last.reading.value2 !== null
      ? `${last.reading.value}/${last.reading.value2} ${last.reading.unit}`
      : `${last.reading.value} ${last.reading.unit}${kind ? ` (${kind})` : ""}`;
  return {
    metric,
    title: SPOT_TITLES[metric],
    unit,
    points,
    points2,
    sentence: null,
    note: metric === "spo2" || metric === "bp" || metric === "glucose" ? TREND_DEVICE_NOTE : null,
    latest: {
      text: latestText,
      day: last.day,
      at: last.reading.measured_at,
      from: sourceLabel(last.reading.source, last.reading.device_name),
    },
    label: `${SPOT_TITLES[metric]}, last ${range} days, average ${Math.round(avg ?? 0)} ${unit}`,
  };
}

/**
 * The charts of the trends screen for one range, in the issue's order. A metric with no
 * reading inside the range is left out; an empty result is the screen's empty state.
 */
export function buildTrendCharts(
  rows: DailyActivityRow[],
  readings: DeviceSpotReading[],
  range: TrendRangeDays,
  today: string,
): TrendChartModel[] {
  const days = mergeActivityDays(rows, today);
  const charts: (TrendChartModel | null)[] = [
    dailyChart("steps", "Steps", "", days, range, today),
    dailyChart("resting_hr", "Resting heart rate", "bpm", days, range, today),
    dailyChart("sleep", "Sleep", "min", days, range, today),
    spotChart("spo2", readings, range, today),
    spotChart("bp", readings, range, today),
    spotChart("glucose", readings, range, today),
    spotChart("weight", readings, range, today),
    spotChart("heart_rate", readings, range, today),
  ];
  return charts.filter((c): c is TrendChartModel => c !== null);
}
