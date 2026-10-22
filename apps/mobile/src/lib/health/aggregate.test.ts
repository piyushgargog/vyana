import { describe, expect, it } from "vitest";

import { aggregateSamples, dayKey, mergeDaily } from "./aggregate";
import type { RawSample } from "./types";

const TZ = "Asia/Kolkata";
const sample = (over: Partial<RawSample>): RawSample => ({
  kind: "heart_rate",
  at: "2026-10-21T10:00:00+05:30",
  value: 80,
  externalId: "x",
  deviceName: "Watch",
  ...over,
});

describe("dayKey", () => {
  it("puts 23:59 and 00:01 on different days in the phone's zone", () => {
    expect(dayKey("2026-10-21T23:59:00+05:30", TZ)).toBe("2026-10-21");
    expect(dayKey("2026-10-22T00:01:00+05:30", TZ)).toBe("2026-10-22");
  });

  it("the zone decides, not UTC: 19:00Z is already the next day in Kolkata", () => {
    expect(dayKey("2026-10-21T19:00:00Z", TZ)).toBe("2026-10-22");
    expect(dayKey("2026-10-21T19:00:00Z", "UTC")).toBe("2026-10-21");
  });
});

describe("aggregateSamples — sleep", () => {
  it("counts the night for the day it ends on", () => {
    const agg = aggregateSamples([sample({ kind: "sleep", at: "2026-10-21T23:10:00+05:30", endAt: "2026-10-22T06:30:00+05:30", value: 0 })], TZ);
    expect(agg.sleepMinutesByDay.get("2026-10-22")).toBe(440);
    expect(agg.sleepMinutesByDay.has("2026-10-21")).toBe(false);
  });

  it("adds segments of one night together; a segment with no end is dropped and counted", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "sleep", at: "2026-10-21T23:00:00+05:30", endAt: "2026-10-22T02:00:00+05:30", value: 0 }),
        sample({ kind: "sleep", at: "2026-10-22T02:15:00+05:30", endAt: "2026-10-22T06:00:00+05:30", value: 0 }),
        sample({ kind: "sleep", at: "2026-10-22T07:00:00+05:30", value: 0 }),
      ],
      TZ,
    );
    expect(agg.sleepMinutesByDay.get("2026-10-22")).toBe(180 + 225);
    expect(agg.dropped).toBe(1);
  });
});

describe("aggregateSamples — resting heart rate", () => {
  it("uses the source's own resting value when it gives one", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "resting_hr", at: "2026-10-21T07:00:00+05:30", value: 58 }),
        sample({ kind: "heart_rate", at: "2026-10-21T10:00:00+05:30", value: 40 + 40 }),
      ],
      TZ,
    );
    // The heart-rate sample would give a "resting" of 80; the source's 58 wins.
    expect(agg.restingHrByDay.get("2026-10-21")).toBe(58);
  });

  it("otherwise takes the lowest 5-minute average of the day", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "heart_rate", at: "2026-10-21T10:00:00+05:30", value: 80 }),
        sample({ kind: "heart_rate", at: "2026-10-21T10:02:00+05:30", value: 84 }),
        sample({ kind: "heart_rate", at: "2026-10-21T10:06:00+05:30", value: 61 }),
        sample({ kind: "heart_rate", at: "2026-10-21T14:00:00+05:30", value: 130 }),
      ],
      TZ,
    );
    expect(agg.restingHrByDay.get("2026-10-21")).toBe(61);
  });
});

describe("aggregateSamples — spots and impossible values", () => {
  it("maps spot kinds to the vitals types and units; glucose is a random reading in mg/dL", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "spo2", value: 98, externalId: "s1" }),
        sample({ kind: "blood_pressure", value: 120, value2: 80, externalId: "s2" }),
        sample({ kind: "glucose", value: 104, externalId: "s3" }),
        sample({ kind: "weight", value: 70.4, externalId: "s4" }),
      ],
      TZ,
    );
    expect(agg.spots).toEqual([
      { type: "spo2", value: 98, value2: null, unit: "%", measuredAt: "2026-10-21T10:00:00+05:30", externalId: "s1", deviceName: "Watch" },
      { type: "bp", value: 120, value2: 80, unit: "mmHg", measuredAt: "2026-10-21T10:00:00+05:30", externalId: "s2", deviceName: "Watch" },
      { type: "sugar_random", value: 104, value2: null, unit: "mg/dL", measuredAt: "2026-10-21T10:00:00+05:30", externalId: "s3", deviceName: "Watch" },
      { type: "weight", value: 70.4, value2: null, unit: "kg", measuredAt: "2026-10-21T10:00:00+05:30", externalId: "s4", deviceName: "Watch" },
    ]);
  });

  it("drops a heart rate of 300, a heart rate of 10 and an SpO2 of 45 — and counts them", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "heart_rate", value: 300 }),
        sample({ kind: "heart_rate", value: 10 }),
        sample({ kind: "spo2", value: 45 }),
        sample({ kind: "spo2", value: 98 }),
      ],
      TZ,
    );
    expect(agg.dropped).toBe(3);
    expect(agg.spots).toHaveLength(1);
  });
});

describe("mergeDaily", () => {
  it("platform totals win, samples fill sleep and resting, sample-only days appear", () => {
    const agg = aggregateSamples(
      [
        sample({ kind: "sleep", at: "2026-10-21T23:00:00+05:30", endAt: "2026-10-22T05:00:00+05:30", value: 0 }),
        sample({ kind: "resting_hr", at: "2026-10-22T07:00:00+05:30", value: 57 }),
      ],
      TZ,
    );
    const { days, dropped } = mergeDaily(
      [{ day: "2026-10-22", steps: 8000, activeMinutes: 30, distanceM: 5200, sleepMinutes: null, restingHr: null, deviceName: "Watch" }],
      agg,
    );
    expect(days).toEqual([
      { day: "2026-10-22", steps: 8000, activeMinutes: 30, distanceM: 5200, sleepMinutes: 360, restingHr: 57, deviceName: "Watch" },
    ]);
    expect(dropped).toBe(0);
  });

  it("a day over the steps cap keeps the day but drops the steps, counted", () => {
    const agg = aggregateSamples([], TZ);
    const { days, dropped } = mergeDaily(
      [{ day: "2026-10-22", steps: 250_001, activeMinutes: null, distanceM: null, sleepMinutes: null, restingHr: null, deviceName: null }],
      agg,
    );
    expect(days[0]?.steps).toBeNull();
    expect(dropped).toBe(1);
  });
});
