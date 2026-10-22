// apps/mobile/src/lib/health/aggregate.ts
// The pure heart of the sync (issue #326): records in, per-day aggregates and spot
// readings out. No platform code, no database — every rule here is unit-tested.
// Owner: Vaibhav Parmar

import type { DailyAggregate, RawSample, SpotReading } from "./types";

/** The day an instant falls on in `timeZone`, as `yyyy-mm-dd`. */
export function dayKey(instant: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    typeof instant === "string" ? new Date(instant) : instant,
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes after midnight of an instant in `timeZone` (for the 5-minute windows below). */
function minuteOfDay(instant: string, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

export type AggregatedSamples = {
  spots: SpotReading[];
  sleepMinutesByDay: Map<string, number>;
  restingHrByDay: Map<string, number>;
  /** Values thrown away as impossible, counted — never silently, never stored. */
  dropped: number;
};

const HR_MIN = 20;
const HR_MAX = 250;
const SPO2_MIN = 50;
const SPO2_MAX = 100;
const STEPS_MAX = 200_000;

/**
 * Turns one sync's records into spot readings, sleep per day and resting heart rate per day.
 *
 * - Sleep belongs to the day the night ENDS on: a segment from 23:10 to 06:30 counts for
 *   the day of 06:30, the morning you wake up to it.
 * - Resting heart rate: the source's own resting value when it gives one (the mean, when
 *   it gives several for a day); otherwise the lowest 5-minute average of the day's heart
 *   rate samples — the quietest five minutes are the closest thing to resting the samples
 *   hold. The source's value wins because the platform computes it from the whole day,
 *   including hours this sync did not read.
 * - Impossible values are dropped and counted: heart rate outside 20–250, SpO2 outside
 *   50–100. (Steps over the daily cap are dropped in `mergeDaily`, where steps arrive.)
 */
export function aggregateSamples(samples: readonly RawSample[], timeZone: string): AggregatedSamples {
  const spots: SpotReading[] = [];
  const sleepMinutesByDay = new Map<string, number>();
  const restingValuesByDay = new Map<string, number[]>();
  const hrWindowsByDay = new Map<string, Map<number, number[]>>();
  let dropped = 0;

  for (const s of samples) {
    switch (s.kind) {
      case "sleep": {
        if (!s.endAt) {
          dropped++;
          break;
        }
        const minutes = Math.round((new Date(s.endAt).getTime() - new Date(s.at).getTime()) / 60_000);
        if (minutes <= 0) {
          dropped++;
          break;
        }
        const day = dayKey(s.endAt, timeZone);
        sleepMinutesByDay.set(day, (sleepMinutesByDay.get(day) ?? 0) + minutes);
        break;
      }
      case "resting_hr": {
        if (s.value < HR_MIN || s.value > HR_MAX) {
          dropped++;
          break;
        }
        const day = dayKey(s.at, timeZone);
        restingValuesByDay.set(day, [...(restingValuesByDay.get(day) ?? []), s.value]);
        break;
      }
      case "heart_rate": {
        if (s.value < HR_MIN || s.value > HR_MAX) {
          dropped++;
          break;
        }
        const day = dayKey(s.at, timeZone);
        const window = Math.floor(minuteOfDay(s.at, timeZone) / 5);
        const windows = hrWindowsByDay.get(day) ?? new Map<number, number[]>();
        windows.set(window, [...(windows.get(window) ?? []), s.value]);
        hrWindowsByDay.set(day, windows);
        break;
      }
      case "spo2": {
        if (s.value < SPO2_MIN || s.value > SPO2_MAX) {
          dropped++;
          break;
        }
        spots.push({ type: "spo2", value: s.value, value2: null, unit: "%", measuredAt: s.at, externalId: s.externalId, deviceName: s.deviceName });
        break;
      }
      case "blood_pressure":
        spots.push({ type: "bp", value: s.value, value2: s.value2 ?? null, unit: "mmHg", measuredAt: s.at, externalId: s.externalId, deviceName: s.deviceName });
        break;
      case "glucose":
        // A device does not know whether a reading was fasting; the honest bucket is a
        // random reading. The value arrives in mg/dL (the mappers convert).
        spots.push({ type: "sugar_random", value: s.value, value2: null, unit: "mg/dL", measuredAt: s.at, externalId: s.externalId, deviceName: s.deviceName });
        break;
      case "weight":
        spots.push({ type: "weight", value: s.value, value2: null, unit: "kg", measuredAt: s.at, externalId: s.externalId, deviceName: s.deviceName });
        break;
    }
  }

  const restingHrByDay = new Map<string, number>();
  const days = new Set([...restingValuesByDay.keys(), ...hrWindowsByDay.keys()]);
  for (const day of days) {
    const resting = restingValuesByDay.get(day);
    if (resting && resting.length > 0) {
      restingHrByDay.set(day, Math.round(resting.reduce((a, b) => a + b, 0) / resting.length));
      continue;
    }
    const windows = hrWindowsByDay.get(day);
    if (windows && windows.size > 0) {
      const averages = [...windows.values()].map((values) => values.reduce((a, b) => a + b, 0) / values.length);
      restingHrByDay.set(day, Math.round(Math.min(...averages)));
    }
  }

  return { spots, sleepMinutesByDay, restingHrByDay, dropped };
}

/**
 * Joins the platform's own daily totals with what the samples produced. A platform value
 * wins over a sample-computed one field by field (the platform dedupes overlapping
 * records); sleep and resting heart rate exist only on the sample side. A day over the
 * steps cap is treated as corrupt: the steps are dropped (counted), the rest of the day
 * is kept.
 */
export function mergeDaily(
  platformDays: readonly DailyAggregate[],
  agg: AggregatedSamples,
): { days: DailyAggregate[]; dropped: number } {
  let dropped = agg.dropped;
  const byDay = new Map<string, DailyAggregate>();
  for (const d of platformDays) {
    byDay.set(d.day, { ...d });
  }
  const ensure = (day: string): DailyAggregate => {
    const found = byDay.get(day);
    if (found) return found;
    const fresh: DailyAggregate = { day, steps: null, activeMinutes: null, distanceM: null, sleepMinutes: null, restingHr: null, deviceName: null };
    byDay.set(day, fresh);
    return fresh;
  };
  for (const [day, minutes] of agg.sleepMinutesByDay) {
    const row = ensure(day);
    if (row.sleepMinutes === null) row.sleepMinutes = minutes;
  }
  for (const [day, hr] of agg.restingHrByDay) {
    const row = ensure(day);
    if (row.restingHr === null) row.restingHr = hr;
  }
  for (const row of byDay.values()) {
    if (row.steps !== null && row.steps > STEPS_MAX) {
      row.steps = null;
      dropped++;
    }
  }
  return { days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)), dropped };
}
