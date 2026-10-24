// packages/shared/src/health/refill.ts
// How many days of a medicine are left, from what was dispensed and what was taken (plan 7.5).
// Owner: Vaibhav Parmar

import { DEFAULT_TIMES, type FrequencyType } from "../constants";
import type { DbDoseLog, DbPrescriptionItem } from "../db/types";
import { addDays, daysBetween, formatLocalDate } from "./dates";

export type RefillItem = Pick<DbPrescriptionItem, "id" | "dose" | "times" | "quantity_total" | "refill_alert_days" | "active" | "end_date">;

export type RefillStatus = {
  /** Units still in the pack (tablets, ml, puffs), or null when the quantity dispensed is unknown. */
  units_left: number | null;
  /** Whole days the units last at the scheduled rate, or null for as-needed medicines and unknown quantities. */
  days_left: number | null;
  /** True when it is time to reorder: `days_left` is within `refill_alert_days`, or the pack is empty. */
  refill_due: boolean;
};

/** Units that are counted one by one: a dose of "2 tablets" or "5 ml" uses 2 or 5 of them. */
const COUNTABLE_UNITS = new Set([
  "tablet", "tablets", "tab", "tabs", "capsule", "capsules", "cap", "caps", "goli", "piece", "pieces", "pc", "pcs",
  "ml", "puff", "puffs", "drop", "drops", "gtt", "sachet", "sachets", "spoon", "spoons", "spoonful", "spoonfuls",
  "tsp", "tbsp", "teaspoon", "teaspoons", "tablespoon", "tablespoons",
]);

/**
 * Units in one dose, from text such as "1 tablet", "2 tablets", "5 ml", "1/2 tablet" or "0.5 tablet".
 * A number counts only when a countable unit follows it (or nothing does). A strength such as
 * "500 mg", "650mg", "40 mg OD", "2 g" or "10 IU" is how strong the medicine is, not how many to take,
 * so it counts as 1. A dose that cannot be read counts as 1.
 */
export function parseDoseUnits(dose: string | null | undefined): number {
  if (!dose) return 1;
  const text = dose.trim().toLowerCase();

  let value: number;
  let rest: string;
  const fraction = text.match(/^(\d{1,3})\s{0,3}\/\s{0,3}(\d{1,3})/);
  const number = text.match(/^(\d{1,4}(?:\.\d{1,3})?)/);
  if (fraction) {
    value = Number(fraction[1]) / Number(fraction[2]);
    rest = text.slice(fraction[0].length);
  } else if (number) {
    value = Number(number[1]);
    rest = text.slice(number[0].length);
  } else {
    return 1;
  }
  if (!Number.isFinite(value) || value <= 0) return 1;

  const unit = rest.trim().match(/^(?:[a-z]+|%)/)?.[0];
  // "500" alone, or a countable unit: count it. Any other unit (mg, mcg, g, iu, ...) is a strength.
  return unit === undefined || COUNTABLE_UNITS.has(unit) ? value : 1;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The one days-left engine (#508). Both "days left" answers in the app run through here, so
 * they cannot drift apart: the only difference is where `units_left` comes from.
 *
 * - `getRefillStatus`: units left from what was actually logged as taken. This is the source
 *   of truth for refill alerts and the care agent's refill card, because those have the logs.
 * - `getScheduledRefillStatus`: units left from the schedule — the doses that should have been
 *   taken since `start_date`. This is the estimate the prescription and dashboard screens show,
 *   because those screens do not load dose logs; it agrees with the logged answer whenever the
 *   patient logged every dose they took.
 *
 * Days left = units left / units per day, rounded down. A medicine is due for a refill when
 * `days_left <= refill_alert_days`, unless it is switched off or the course ends before the
 * pack would run out.
 */
export function deriveRefillStatus(
  input: {
    units_left: number;
    /** Units used per day (dose slots per day times units per dose); 0 for as-needed medicines. */
    units_per_day: number;
    refill_alert_days: number;
    active: boolean;
    end_date: string | null;
  },
  today: Date = new Date()
): RefillStatus {
  const { units_left: unitsLeft, units_per_day: perDay } = input;
  const daysLeft = perDay > 0 ? Math.floor(unitsLeft / perDay) : null;

  if (!input.active) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false };

  const todayText = formatLocalDate(today);
  if (input.end_date) {
    const daysToEnd = daysBetween(todayText, input.end_date);
    if (daysToEnd < 0) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false }; // course is over
    if (daysLeft !== null && daysToEnd < daysLeft) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false }; // finishes first
  }

  const due = unitsLeft === 0 || (daysLeft !== null && daysLeft <= input.refill_alert_days);
  return { units_left: unitsLeft, days_left: daysLeft, refill_due: due };
}

/**
 * Units left = quantity dispensed minus the doses logged as taken (times the units per dose).
 *
 * Only doses that were logged as taken count, so a patient who takes medicine without logging it
 * looks like they have more left than they do.
 */
export function getRefillStatus(item: RefillItem, doseLogs: Pick<DbDoseLog, "item_id" | "status">[], today: Date = new Date()): RefillStatus {
  if (item.quantity_total === null || item.quantity_total === undefined) return { units_left: null, days_left: null, refill_due: false };

  const perDose = parseDoseUnits(item.dose);
  const taken = doseLogs.filter((log) => log.item_id === item.id && log.status === "taken").length;
  const unitsLeft = Math.max(0, round2(item.quantity_total - taken * perDose));
  return deriveRefillStatus(
    { units_left: unitsLeft, units_per_day: item.times.length * perDose, refill_alert_days: item.refill_alert_days, active: item.active, end_date: item.end_date },
    today
  );
}

export type ScheduledRefillItem = Pick<
  DbPrescriptionItem,
  "dose" | "times" | "frequency" | "quantity_total" | "start_date" | "end_date" | "refill_alert_days" | "active"
>;

export type ScheduledRefillStatus = RefillStatus & {
  /** The calendar day the pack runs out on the schedule, or null when it cannot be worked out. */
  refill_date: string | null;
};

/**
 * The schedule-assumed twin of `getRefillStatus`, for screens that do not load dose logs
 * (`computeItemRefill` in ui-helpers is a thin shape adapter over this). Units left = quantity
 * dispensed minus the doses the schedule says should have been taken since `start_date`
 * (dose slots per day from `times`, falling back to the frequency default, times the units per
 * dose from `parseDoseUnits` — so "2 tablets" twice a day uses 4 units a day, while a strength
 * such as "500 mg" still uses 1). The days-left math itself is `deriveRefillStatus`, shared
 * with the logged answer, so the two can only differ by logged-vs-assumed consumption — never
 * by the arithmetic, the per-dose units, or the switched-off / course-ended rules.
 */
export function getScheduledRefillStatus(item: ScheduledRefillItem, now: Date = new Date()): ScheduledRefillStatus {
  if (!item.quantity_total || item.quantity_total <= 0 || !item.start_date) {
    return { units_left: null, days_left: null, refill_due: false, refill_date: null };
  }
  const times =
    item.times && item.times.length > 0
      ? item.times
      : DEFAULT_TIMES[(item.frequency as FrequencyType) ?? "OD"] ?? [];
  const perDose = parseDoseUnits(item.dose);
  const perDay = times.length * perDose;
  if (perDay <= 0) {
    // As-needed: the pack size is known but no daily rate, so there is no days-left number.
    return { units_left: item.quantity_total, days_left: null, refill_due: false, refill_date: null };
  }
  const todayText = formatLocalDate(now);
  const elapsedDays = Math.max(0, daysBetween(item.start_date, todayText));
  const unitsLeft = Math.max(0, round2(item.quantity_total - elapsedDays * perDay));
  const totalDays = Math.floor(item.quantity_total / perDay);
  const status = deriveRefillStatus(
    { units_left: unitsLeft, units_per_day: perDay, refill_alert_days: item.refill_alert_days, active: item.active, end_date: item.end_date },
    now
  );
  return { ...status, refill_date: addDays(item.start_date, totalDays) };
}
