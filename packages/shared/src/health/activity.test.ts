import { describe, expect, it } from "vitest";

import {
  buildActivityCard,
  buildLabChart,
  buildTrendCharts,
  formatLabValue,
  TREND_DEVICE_NOTE,
  mergeActivityDays,
  sourceLabel,
  type DailyActivityRow,
  type DeviceSpotReading,
  type LabValueRow,
} from "./activity";
import { addDays } from "./dates";
import { formatSleep } from "./trends";

const TODAY = "2026-10-22";

/** A daily row `back` days before today, from a watch, with only the given fields set. */
const row = (back: number, fields: Partial<DailyActivityRow>): DailyActivityRow => ({
  day: addDays(TODAY, -back),
  steps: null,
  sleep_minutes: null,
  resting_hr: null,
  source: "health_connect",
  device_name: "Pixel Watch",
  ...fields,
});

const reading = (fields: Partial<DeviceSpotReading>): DeviceSpotReading => ({
  type: "spo2",
  value: 98,
  value2: null,
  unit: "%",
  measured_at: "2026-10-22T02:30:00.000Z",
  source: "health_connect",
  device_name: "Pixel Watch",
  ...fields,
});

describe("sourceLabel", () => {
  it("uses the device's own name when the row carries one", () => {
    expect(sourceLabel("health_connect", "Pixel Watch")).toBe("Pixel Watch");
  });

  it("falls back to the store names of ADR-073, then to plain 'device'", () => {
    expect(sourceLabel("health_connect", null)).toBe("Health Connect");
    expect(sourceLabel("healthkit", null)).toBe("HealthKit");
    expect(sourceLabel("ble", null)).toBe("device");
    expect(sourceLabel("healthkit", "  ")).toBe("HealthKit");
  });
});

describe("mergeActivityDays", () => {
  it("drops future rows and sorts the days", () => {
    const days = mergeActivityDays([row(0, { steps: 100 }), row(2, { steps: 300 }), row(-1, { steps: 999 })], TODAY);
    expect(days.map((d) => d.day)).toEqual([addDays(TODAY, -2), TODAY]);
  });

  it("keeps the last row's value per field, with that row's device", () => {
    const days = mergeActivityDays(
      [
        row(0, { steps: 5000, sleep_minutes: 400 }),
        { ...row(0, { steps: 7000 }), source: "healthkit", device_name: "iPhone" },
      ],
      TODAY,
    );
    expect(days).toHaveLength(1);
    expect(days[0].steps).toEqual({ value: 7000, from: "iPhone" });
    // The second row holds no sleep, so the first row's sleep (and its device) stays.
    expect(days[0].sleep_minutes).toEqual({ value: 400, from: "Pixel Watch" });
  });
});

describe("formatSleep", () => {
  it("writes hours and minutes the way the trend sentences do", () => {
    expect(formatSleep(452)).toBe("7 h 32 min");
    expect(formatSleep(60)).toBe("1 h");
    expect(formatSleep(45)).toBe("45 min");
    expect(formatSleep(0)).toBe("0 min");
  });
});

describe("buildActivityCard", () => {
  it("is empty when there are no rows", () => {
    const card = buildActivityCard([], TODAY, null);
    expect(card).toEqual({ has_data: false, steps: null, resting_hr: null, sleep: null });
  });

  it("shows today's steps with a ring fill only when a goal exists", () => {
    const rows = [row(0, { steps: 5000 })];
    expect(buildActivityCard(rows, TODAY, 10000).steps).toEqual({ value: 5000, from: "Pixel Watch", goal: 10000, fill: 0.5 });
    // No goal in the profile: the number only, no fill claim.
    expect(buildActivityCard(rows, TODAY, null).steps).toEqual({ value: 5000, from: "Pixel Watch", goal: null, fill: null });
  });

  it("caps the ring fill at the goal and ignores steps of other days", () => {
    const rows = [row(1, { steps: 9000 }), row(0, { steps: 12000 })];
    const card = buildActivityCard(rows, TODAY, 10000);
    expect(card.steps?.value).toBe(12000);
    expect(card.steps?.fill).toBe(1);
    expect(buildActivityCard([row(1, { steps: 9000 })], TODAY, null).steps).toBeNull();
  });

  it("shows the resting heart rate arrow only with at least 4 days in the last 7", () => {
    const three = buildActivityCard([row(0, { resting_hr: 62 }), row(1, { resting_hr: 61 }), row(2, { resting_hr: 63 })], TODAY, null);
    expect(three.resting_hr).toMatchObject({ value: 62, average_7d: null, arrow: null });

    const seven = [72, 60, 60, 60, 60, 60, 60].map((v, i) => row(i, { resting_hr: v }));
    const card = buildActivityCard(seven, TODAY, null);
    expect(card.resting_hr).toMatchObject({ value: 72, average_7d: 61.7, arrow: "up" });
  });

  it("takes last night's sleep from today's row, else yesterday's", () => {
    expect(buildActivityCard([row(0, { sleep_minutes: 450 })], TODAY, null).sleep).toEqual({
      minutes: 450,
      text: "7 h 30 min",
      from: "Pixel Watch",
      day: TODAY,
    });
    const yesterday = buildActivityCard([row(1, { sleep_minutes: 400 })], TODAY, null);
    expect(yesterday.sleep?.day).toBe(addDays(TODAY, -1));
    expect(buildActivityCard([row(3, { sleep_minutes: 400 })], TODAY, null).sleep).toBeNull();
  });
});

describe("buildTrendCharts", () => {
  it("is empty when nothing was recorded", () => {
    expect(buildTrendCharts([], [], 7, TODAY)).toEqual([]);
  });

  it("slices the daily charts to the range and words the sentence with describeTrend", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { steps: 8000 })),
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { steps: 6000 })),
      row(20, { steps: 5000 }),
    ];
    const [steps7] = buildTrendCharts(rows, [], 7, TODAY);
    expect(steps7.metric).toBe("steps");
    expect(steps7.points).toHaveLength(7);
    expect(steps7.sentence).toBe("About 2000 steps a day more than the week before.");
    expect(steps7.label).toBe("Steps, last 7 days, average 8000 steps");
    expect(steps7.note).toBeNull();

    const [steps30] = buildTrendCharts(rows, [], 30, TODAY);
    expect(steps30.points).toHaveLength(15);
    expect(steps30.label).toBe("Steps, last 30 days, average 6867 steps");
  });

  it("puts the not-a-medical-test line under SpO2, blood pressure and glucose, and no sentence", () => {
    const charts = buildTrendCharts(
      [],
      [
        reading({}),
        reading({ type: "bp", value: 138, value2: 88, unit: "mmHg" }),
        reading({ type: "sugar_random", value: 118, unit: "mg/dL" }),
        reading({ type: "weight", value: 70, unit: "kg" }),
      ],
      7,
      TODAY,
    );
    const byMetric = new Map(charts.map((c) => [c.metric, c]));
    expect(byMetric.get("spo2")?.note).toBe(TREND_DEVICE_NOTE);
    expect(byMetric.get("bp")?.note).toBe(TREND_DEVICE_NOTE);
    expect(byMetric.get("glucose")?.note).toBe(TREND_DEVICE_NOTE);
    expect(byMetric.get("weight")?.note).toBeNull();
    for (const chart of charts) expect(chart.sentence).toBeNull();
  });

  it("carries the diastolic as the second line of the blood pressure chart, with gaps", () => {
    const [bp] = buildTrendCharts(
      [],
      [
        reading({ type: "bp", value: 120, value2: 80, unit: "mmHg", measured_at: "2026-10-20T03:00:00.000Z" }),
        reading({ type: "bp", value: 130, value2: null, unit: "mmHg", measured_at: "2026-10-21T03:00:00.000Z" }),
      ],
      7,
      TODAY,
    );
    expect(bp.points.map((p) => p.value)).toEqual([120, 130]);
    expect(bp.points2?.map((p) => p?.value ?? null)).toEqual([80, null]);
    expect(bp.latest?.text).toBe("130 mmHg");
  });

  it("names the kind of the latest glucose reading and counts a reading by its India day", () => {
    const [glucose] = buildTrendCharts(
      [],
      [
        reading({ type: "sugar_fasting", value: 95, unit: "mg/dL", measured_at: "2026-10-21T01:00:00.000Z" }),
        // 20:00 UTC is 01:30 in India the next day, so this reading belongs to today.
        reading({ type: "sugar_random", value: 118, unit: "mg/dL", measured_at: "2026-10-21T20:00:00.000Z" }),
      ],
      7,
      TODAY,
    );
    expect(glucose.points).toHaveLength(2);
    expect(glucose.latest).toMatchObject({ text: "118 mg/dL (random)", day: TODAY, from: "Pixel Watch" });
  });

  it("leaves readings outside the range out of the chart", () => {
    const charts = buildTrendCharts([], [reading({ measured_at: "2026-09-01T02:30:00.000Z" })], 7, TODAY);
    expect(charts).toEqual([]);
    const [spo2] = buildTrendCharts([], [reading({ measured_at: "2026-09-01T02:30:00.000Z" })], 90, TODAY);
    expect(spo2.metric).toBe("spo2");
    expect(spo2.latest?.text).toBe("98 %");
  });
});

describe("buildLabChart", () => {
  const labRow = (fields: Partial<LabValueRow>): LabValueRow => ({
    measured_on: "2025-10-20",
    value: 5.4,
    flag: "normal",
    ref_low: 4,
    ref_high: 5.6,
    unit: "%",
    ...fields,
  });

  it("returns null when no row has both a value and a date", () => {
    expect(buildLabChart([], { title: "HbA1c" })).toBeNull();
    expect(buildLabChart([labRow({ value: null })], { title: "HbA1c" })).toBeNull();
    expect(buildLabChart([labRow({ measured_on: null })], { title: "HbA1c" })).toBeNull();
  });

  it("sorts points into chronological order and drops unusable rows", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2026-01-23", value: 6.1, flag: "high" }),
        labRow({ measured_on: "2025-10-20", value: 5.4 }),
        labRow({ measured_on: null, value: 9.9 }),
        labRow({ measured_on: "2025-07-22", value: null }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.points.map((p) => p.day)).toEqual(["2025-10-20", "2026-01-23"]);
  });

  it("shows the year on the first point and when the year changes, not otherwise", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-01-20" }),
        labRow({ measured_on: "2025-07-22" }),
        labRow({ measured_on: "2026-01-23" }),
        labRow({ measured_on: "2026-10-13" }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.points.map((p) => p.dateLabel)).toEqual([
      "20 Jan 2025",
      "22 Jul",
      "23 Jan 2026",
      "13 Oct",
    ]);
  });

  it("names an out-of-range value in words, from the stored flag when the row states no bounds", () => {
    const noBounds = { ref_low: null, ref_high: null };
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-10-20", value: 7.2, flag: "high", ...noBounds }),
        labRow({ measured_on: "2026-01-23", value: 3.8, flag: "low", ...noBounds }),
        labRow({ measured_on: "2026-04-10", value: 5.1, flag: "normal", ...noBounds }),
        labRow({ measured_on: "2026-07-01", value: 5.2, flag: "unknown", ...noBounds }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.points.map((p) => [p.status, p.statusText])).toEqual([
      ["above", "Above range"],
      ["below", "Below range"],
      ["in", null],
      ["unknown", null],
    ]);
    expect(chart?.points[0].a11yLabel).toBe("20 October 2025: 7.2 percent, above range");
    expect(chart?.points[2].a11yLabel).toBe("10 April 2026: 5.1 percent, in range");
    // An unflagged row makes no claim: the screen reader hears the value only.
    expect(chart?.points[3].a11yLabel).toBe("1 July 2026: 5.2 percent");
  });

  it("places a value against the bounds its own row states, whatever the flag says", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-10-20", value: 7.2, flag: "unknown" }),
        labRow({ measured_on: "2026-01-23", value: 5.2, flag: "unknown" }),
        labRow({ measured_on: "2026-04-10", value: 3.8, flag: null }),
        labRow({ measured_on: "2026-07-01", value: 5.2, flag: "high" }),
      ],
      { title: "HbA1c" },
    );
    // The default row states bounds 4–5.6: an unknown flag no longer defaults to "in",
    // and a stored flag that disagrees with the row's own bounds does not win.
    expect(chart?.points.map((p) => p.status)).toEqual(["above", "in", "below", "in"]);
    expect(chart?.points[0].a11yLabel).toBe("20 October 2025: 7.2 percent, above range");
    expect(chart?.points[1].a11yLabel).toBe("23 January 2026: 5.2 percent, in range");
  });

  it("makes no in-range claim when a row states neither bounds nor a known flag", () => {
    const noBounds = { ref_low: null, ref_high: null };
    for (const flag of ["unknown", null, "critical"]) {
      const chart = buildLabChart(
        [labRow({ measured_on: "2025-10-20", value: 7.2, flag, ...noBounds })],
        { title: "HbA1c" },
      );
      expect(chart?.points[0].status).toBe("unknown");
      expect(chart?.points[0].statusText).toBeNull();
      expect(chart?.points[0].a11yLabel).toBe("20 October 2025: 7.2 percent");
      expect(chart?.headline).toBe("Latest: 7.2% on 20 October 2025.");
    }
  });

  it("does not judge the latest value against a band drawn from another row", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-10-20", value: 5.4 }),
        labRow({ measured_on: "2026-01-23", value: 7.2, flag: "high", ref_low: null, ref_high: null }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.refLow).toBe(4);
    expect(chart?.refHigh).toBe(5.6);
    expect(chart?.headline).toBe("Latest: 7.2% on 23 January 2026 — above the range on its report.");
  });

  it("draws the band from the newest row that states both bounds", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-10-20", ref_low: 4, ref_high: 5.6 }),
        labRow({ measured_on: "2026-01-23", ref_low: null, ref_high: null }),
        labRow({ measured_on: "2026-04-10", ref_low: 4.2, ref_high: 5.8 }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.refLow).toBe(4.2);
    expect(chart?.refHigh).toBe(5.8);
  });

  it("builds the headline from the latest point and the stated range", () => {
    const above = buildLabChart(
      [labRow({ measured_on: "2025-10-13", value: 7.2, flag: "high" })],
      { title: "HbA1c" },
    );
    expect(above?.headline).toBe(
      "Latest: 7.2% on 13 October 2025 — above the reference range (4–5.6%).",
    );
    const inside = buildLabChart(
      [labRow({ measured_on: "2025-10-13", value: 5.4, flag: "normal" })],
      { title: "HbA1c" },
    );
    expect(inside?.headline).toBe(
      "Latest: 5.4% on 13 October 2025 — in the reference range (4–5.6%).",
    );
    const noRange = buildLabChart(
      [labRow({ measured_on: "2025-10-13", value: 7.2, flag: "high", ref_low: null, ref_high: null })],
      { title: "HbA1c" },
    );
    expect(noRange?.headline).toBe("Latest: 7.2% on 13 October 2025 — above the range on its report.");
    expect(noRange?.refLow).toBeNull();
  });

  it("summarises the chart for a screen reader", () => {
    const chart = buildLabChart(
      [
        labRow({ measured_on: "2025-10-20", value: 5.4 }),
        labRow({ measured_on: "2026-10-13", value: 7.2, flag: "high" }),
      ],
      { title: "HbA1c" },
    );
    expect(chart?.label).toBe(
      "HbA1c, 2 readings, 20 October 2025 to 13 October 2026. Latest: 7.2% on 13 October 2026 — above the reference range (4–5.6%).",
    );
  });

  it("formats stored values without float noise", () => {
    expect(formatLabValue(7.2000000001)).toBe("7.2");
    expect(formatLabValue(5)).toBe("5");
    expect(formatLabValue(0.125)).toBe("0.13");
  });
});
