import { describe, expect, it } from "vitest";

import { buildTodayBrief, type TodayBriefInput } from "./brief";
import type { DayValue } from "./trends";

const TODAY = "2026-10-23";

/** Resting heart rate for the 14 days ending today: `recent` for the last 7, `before` for the 7 before those. */
function hrValues(recent: number, before: number): DayValue[] {
  const values: DayValue[] = [];
  for (let d = 17; d <= 23; d++) values.push({ day: `2026-10-${d}`, value: recent });
  for (let d = 10; d <= 16; d++) values.push({ day: `2026-10-${d}`, value: before });
  return values;
}

const base: TodayBriefInput = {
  nextDose: { medicineName: "Metformin", time: "21:00" },
  dosesScheduled: 3,
  restingHeartRate: null,
  hasCareSuggestion: false,
};

describe("buildTodayBrief (#488)", () => {
  it("leads with the next dose", () => {
    const brief = buildTodayBrief(base);
    expect(brief.doseLine).toBe("Next dose: Metformin at 21:00");
    expect(brief.lines).toEqual(["Next dose: Metformin at 21:00"]);
  });

  it("says all done when doses were scheduled and none are left", () => {
    const brief = buildTodayBrief({ ...base, nextDose: null });
    expect(brief.doseLine).toBe("All done for today");
    expect(brief.lines).toEqual(["All done for today"]);
  });

  it("has no dose line when nothing was scheduled", () => {
    const brief = buildTodayBrief({ ...base, nextDose: null, dosesScheduled: 0 });
    expect(brief.doseLine).toBeNull();
    expect(brief.lines).toEqual([]);
  });

  it("reports a resting heart rate drop in the fixed trend words", () => {
    const brief = buildTodayBrief({
      ...base,
      restingHeartRate: { values: hrValues(60, 66), today: TODAY },
    });
    expect(brief.changeLine).toBe(
      "Resting heart rate: about 6 beats a minute less than the week before.",
    );
  });

  it("reports a resting heart rate rise in the fixed trend words", () => {
    const brief = buildTodayBrief({
      ...base,
      restingHeartRate: { values: hrValues(70, 64), today: TODAY },
    });
    expect(brief.changeLine).toBe(
      "Resting heart rate: about 6 beats a minute more than the week before.",
    );
  });

  it("stays silent when the heart rate is about the same", () => {
    const brief = buildTodayBrief({
      ...base,
      restingHeartRate: { values: hrValues(65, 66), today: TODAY },
    });
    expect(brief.changeLine).toBeNull();
  });

  it("stays silent when there are too few days of readings", () => {
    const brief = buildTodayBrief({
      ...base,
      restingHeartRate: {
        values: [
          { day: "2026-10-22", value: 60 },
          { day: "2026-10-23", value: 61 },
        ],
        today: TODAY,
      },
    });
    expect(brief.changeLine).toBeNull();
  });

  it("adds the doctor line only when a care suggestion is waiting", () => {
    expect(buildTodayBrief(base).doctorLine).toBeNull();
    const brief = buildTodayBrief({ ...base, hasCareSuggestion: true });
    expect(brief.doctorLine).toBe("Ask your doctor");
    expect(brief.lines).toEqual(["Next dose: Metformin at 21:00", "Ask your doctor"]);
  });

  it("orders the lines: dose, change, doctor", () => {
    const brief = buildTodayBrief({
      ...base,
      restingHeartRate: { values: hrValues(60, 66), today: TODAY },
      hasCareSuggestion: true,
    });
    expect(brief.lines).toEqual([
      "Next dose: Metformin at 21:00",
      "Resting heart rate: about 6 beats a minute less than the week before.",
      "Ask your doctor",
    ]);
  });
});
