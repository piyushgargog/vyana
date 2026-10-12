// packages/shared/src/health/refill.ts
// How many days of a medicine are left, from what was dispensed and what was taken (plan 7.5).
// Owner: Vaibhav Parmar

import type { DbDoseLog, DbPrescriptionItem } from "../db/types";
import { daysBetween, formatLocalDate } from "./dates";

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
 * Units left = quantity dispensed minus the doses logged as taken (times the units per dose).
 * Days left = units left / (doses per day * units per dose), rounded down. A medicine is due for a
 * refill when `days_left <= refill_alert_days`, unless the course ends before it would run out.
 *
 * Only doses that were logged as taken count, so a patient who takes medicine without logging it
 * looks like they have more left than they do.
 */
export function getRefillStatus(item: RefillItem, doseLogs: Pick<DbDoseLog, "item_id" | "status">[], today: Date = new Date()): RefillStatus {
  if (item.quantity_total === null || item.quantity_total === undefined) return { units_left: null, days_left: null, refill_due: false };

  const perDose = parseDoseUnits(item.dose);
  const taken = doseLogs.filter((log) => log.item_id === item.id && log.status === "taken").length;
  const unitsLeft = Math.max(0, round2(item.quantity_total - taken * perDose));
  const perDay = item.times.length * perDose;
  const daysLeft = perDay > 0 ? Math.floor(unitsLeft / perDay) : null;

  if (!item.active) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false };

  const todayText = formatLocalDate(today);
  if (item.end_date) {
    const daysToEnd = daysBetween(todayText, item.end_date);
    if (daysToEnd < 0) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false }; // course is over
    if (daysLeft !== null && daysToEnd < daysLeft) return { units_left: unitsLeft, days_left: daysLeft, refill_due: false }; // finishes first
  }

  const due = unitsLeft === 0 || (daysLeft !== null && daysLeft <= item.refill_alert_days);
  return { units_left: unitsLeft, days_left: daysLeft, refill_due: due };
}
