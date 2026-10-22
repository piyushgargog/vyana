import { describe, expect, it } from "vitest";

import { addDays } from "./dates";
import { computeTrend, describeTrend, type DayValue, type TrendMetric } from "./trends";

const TODAY = "2026-10-22";

/** `values[i]` is the reading of the day `i` days before today (index 0 is today); `null` leaves that day out. */
const days = (values: (number | null)[]): DayValue[] =>
  values.flatMap((value, i) => (value === null ? [] : [{ day: addDays(TODAY, -i), value }]));
const run = (values: DayValue[], metric: TrendMetric) => {
  const trend = computeTrend(values, TODAY, metric);
  return { trend, text: describeTrend(trend, metric) };
};
const repeat = (n: number, value: number) => Array<number>(n).fill(value);

describe("computeTrend and describeTrend", () => {
  it("is flat for 14 steady days", () => {
    const { trend, text } = run(days(repeat(14, 7000)), "steps");
    expect(trend).toMatchObject({ enough_data: true, current_avg: 7000, previous_avg: 7000, change: 0, direction: "flat" });
    expect(text).toBe("About the same as the week before.");
  });

  it("is up when steps rise by 2000 a day", () => {
    const { trend, text } = run(days([...repeat(7, 8000), ...repeat(7, 6000)]), "steps");
    expect(trend).toMatchObject({ current_avg: 8000, previous_avg: 6000, change: 2000, direction: "up" });
    expect(text).toBe("About 2000 steps a day more than the week before.");
  });

  it("is flat when the unrounded change is just under the flat limit, even though it rounds onto it", () => {
    // The proof case of issue #372: an average of 7499.96 against 7000 is a raw change of 499.96,
    // under the 500 flat limit, but the rounded change is exactly 500.
    const { trend, text } = run(days([...repeat(7, 7499.96), ...repeat(7, 7000)]), "steps");
    expect(trend).toMatchObject({ change: 500, direction: "flat" });
    expect(text).toBe("About the same as the week before.");
  });

  it("is flat when the unrounded change is just over the negative flat limit, even though it rounds onto it", () => {
    const { trend, text } = run(days([...repeat(7, 6500.04), ...repeat(7, 7000)]), "steps");
    expect(trend).toMatchObject({ change: -500, direction: "flat" });
    expect(text).toBe("About the same as the week before.");
  });

  it("is up when the change is exactly the flat limit", () => {
    const { trend, text } = run(days([...repeat(7, 7500), ...repeat(7, 7000)]), "steps");
    expect(trend).toMatchObject({ change: 500, direction: "up" });
    expect(text).toBe("About 500 steps a day more than the week before.");
  });

  it("is flat just under the sleep flat limit, even though the change rounds onto it", () => {
    const { trend } = run(days([...repeat(7, 464.96), ...repeat(7, 450)]), "sleep_minutes");
    expect(trend).toMatchObject({ change: 15, direction: "flat" });
  });

  it("is down when the resting heart rate falls by 3", () => {
    const { trend, text } = run(days([...repeat(7, 62), ...repeat(7, 65)]), "resting_hr");
    expect(trend).toMatchObject({ change: -3, direction: "down" });
    expect(text).toContain("3 beats a minute less");
  });

  it("needs 4 days in the last 7 for a trend", () => {
    const three = run(days([70, 70, 70, null, null, null, null]), "resting_hr");
    expect(three.trend.enough_data).toBe(false);
    expect(three.text).toBe("Not enough days of readings yet to show a trend.");
    const four = run(days([70, 70, 70, 70, null, null, null]), "resting_hr");
    expect(four.trend.enough_data).toBe(true);
  });

  it("gives only the average when the week before has too few days", () => {
    const { trend, text } = run(days([...repeat(7, 7000), 5000, 5000]), "steps");
    expect(trend).toMatchObject({ enough_data: true, current_avg: 7000, change: null, direction: null });
    expect(text).toBe("Your average over the last 7 days is 7000 steps a day.");
  });

  it("keeps the last value of a day and ignores NaN, negative and out-of-window values", () => {
    const values: DayValue[] = [
      { day: TODAY, value: 100 },
      { day: TODAY, value: 200 }, // the same day again: this one wins
      { day: addDays(TODAY, -1), value: 100 },
      { day: addDays(TODAY, -2), value: 100 },
      { day: addDays(TODAY, -3), value: 100 },
      { day: addDays(TODAY, -4), value: Number.NaN },
      { day: addDays(TODAY, -5), value: -5 },
      { day: addDays(TODAY, -30), value: 9999 },
      { day: addDays(TODAY, 1), value: 9999 },
    ];
    const { trend } = run(values, "steps");
    expect(trend.current_avg).toBe(125); // (200 + 100 + 100 + 100) / 4: four usable days
    expect(trend.enough_data).toBe(true);
  });

  it("writes sleep as hours and minutes", () => {
    expect(run(days(repeat(7, 450)), "sleep_minutes").text).toBe("Your average over the last 7 days is 7 h 30 min.");
    expect(run(days(repeat(7, 420)), "sleep_minutes").text).toBe("Your average over the last 7 days is 7 h.");
    expect(run(days([...repeat(7, 450), ...repeat(7, 495)]), "sleep_minutes").text).toBe("About 45 min less than the week before.");
  });

  it("never judges: no sentence uses a word of praise, warning or advice", () => {
    const cases: [DayValue[], TrendMetric][] = [
      [days(repeat(14, 7000)), "steps"],
      [days([...repeat(7, 8000), ...repeat(7, 6000)]), "steps"],
      [days([...repeat(7, 62), ...repeat(7, 65)]), "resting_hr"],
      [days([70, 70, 70]), "resting_hr"],
      [days(repeat(7, 450)), "sleep_minutes"],
      [days([...repeat(7, 400), ...repeat(7, 480)]), "sleep_minutes"],
    ];
    for (const [values, metric] of cases) expect(run(values, metric).text).not.toMatch(/\b(good|bad|healthy|normal|high|low|safe|risk)\b/i);
  });
});
