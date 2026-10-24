// packages/shared/src/health/brief.ts
// The words of the Today brief card (issue #488): computed in code from the day's own
// data — the next dose, one real change, and a line for the doctor when a care
// suggestion is waiting. Fixed sentences only; nothing here is written by a model,
// and a number appears only when the data itself carries it.

import { computeTrend, describeTrend, type DayValue } from "./trends";

export interface TodayBriefInput {
  /** The next dose of today that is still to take or skip, or null when none is left. */
  nextDose: { medicineName: string; time: string } | null;
  /**
   * How many doses were scheduled for today. With no next dose this separates
   * "All done for today" (some were scheduled) from a day with nothing scheduled
   * (no dose line at all).
   */
  dosesScheduled: number;
  /**
   * Resting heart rate by day from the connected device, with today as `YYYY-MM-DD`;
   * null when there is no device data. The one change the brief can report today —
   * a lab value that moved joins here when a screen first carries both reports.
   */
  restingHeartRate: { values: DayValue[]; today: string } | null;
  /** A care suggestion is waiting for the patient; the suggestion itself lives on its own card. */
  hasCareSuggestion: boolean;
}

export interface TodayBrief {
  /** "Next dose: … at …", "All done for today", or null when nothing was scheduled. */
  doseLine: string | null;
  /** One real change in the fixed words of `describeTrend`, or null when there is none to report. */
  changeLine: string | null;
  /** "Ask your doctor", present only when a care suggestion is waiting. */
  doctorLine: string | null;
  /** Every line, in display order; empty when there is nothing to say. */
  lines: string[];
}

export function buildTodayBrief(input: TodayBriefInput): TodayBrief {
  const doseLine = input.nextDose
    ? `Next dose: ${input.nextDose.medicineName} at ${input.nextDose.time}`
    : input.dosesScheduled > 0
      ? "All done for today"
      : null;

  let changeLine: string | null = null;
  if (input.restingHeartRate) {
    const trend = computeTrend(input.restingHeartRate.values, input.restingHeartRate.today, "resting_hr");
    // Only a real move is a change: too few days, no comparison week, or "about the
    // same" all stay silent — the brief never fills space with a non-change.
    if (trend.direction === "up" || trend.direction === "down") {
      const sentence = describeTrend(trend, "resting_hr");
      changeLine = `Resting heart rate: ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`;
    }
  }

  const doctorLine = input.hasCareSuggestion ? "Ask your doctor" : null;
  const lines = [doseLine, changeLine, doctorLine].filter((l): l is string => l !== null);
  return { doseLine, changeLine, doctorLine, lines };
}
