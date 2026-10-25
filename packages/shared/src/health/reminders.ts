// packages/shared/src/health/reminders.ts
// What to remind the patient of, and when. Pure functions: the phone schedules what they return
// (apps/mobile/src/lib/notifications.ts). Owner: Vaibhav Parmar

import type { DbDoseLog, DbPrescriptionItem } from "../db/types";
import { addDays, atLocalTime, formatLocalDate } from "./dates";
import { getRefillStatus, type RefillItem } from "./refill";

export type ReminderKind = "dose" | "refill" | "follow_up";

export type PlannedNotification = {
  /** Stable, so scheduling the same reminder again replaces it: `dose:<item>:<date>T<time>`, `refill:<item>:<date>`, `followup:<plan>:<test>`. */
  id: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
  /** Strings only: what the app needs to open the right screen when the notification is tapped. */
  data: Record<string, string>;
};

export type DoseReminderItem = Pick<DbPrescriptionItem, "id" | "medicine_name" | "strength" | "dose" | "times" | "with_food" | "start_date" | "end_date" | "active">;

/**
 * Notification text is visible on a locked screen, and a medicine or test name reveals health data.
 * By default the text says only what the user needs to act ("Time for your 9:00 medicine"); the
 * names go in the text only when `showNames` is true. The ids are always in `data` for the app.
 */
export type TextOptions = { showNames?: boolean };

/** iOS keeps at most 64 pending local notifications; the three kinds share them. */
export const MAX_DOSE_REMINDERS = 48;
export const MAX_REFILL_ALERTS = 8;
export const MAX_FOLLOW_UPS = 8;

/** A logged dose silences the reminder for the same medicine when it is within this many minutes of it. */
const LOGGED_WINDOW_MINUTES = 30;

const FOOD: Record<DbPrescriptionItem["with_food"], string> = { before: "before food", after: "after food", any: "" };

function medicineLabel(item: Pick<DbPrescriptionItem, "medicine_name" | "strength">): string {
  return item.strength ? `${item.medicine_name} ${item.strength}` : item.medicine_name;
}

/**
 * The next dose reminders of the active medicines, nearest first. A dose that is already logged
 * (taken or skipped) within 30 minutes of its time gets no reminder, so marking it taken and
 * planning again removes it.
 */
export function planDoseReminders(
  items: DoseReminderItem[],
  logs: Pick<DbDoseLog, "item_id" | "scheduled_for" | "status">[],
  now: Date,
  options: { horizonDays?: number; max?: number } & TextOptions = {}
): PlannedNotification[] {
  const horizon = options.horizonDays ?? 7;
  const max = options.max ?? MAX_DOSE_REMINDERS;
  const today = formatLocalDate(now);
  const planned: PlannedNotification[] = [];

  for (let offset = 0; offset <= horizon; offset++) {
    const date = addDays(today, offset);
    for (const item of items) {
      if (!item.active || date < item.start_date || (item.end_date && date > item.end_date)) continue;
      for (const time of item.times) {
        const at = atLocalTime(date, time);
        if (at.getTime() <= now.getTime() + 5000) continue;
        const logged = logs.some(
          (log) =>
            log.item_id === item.id &&
            (log.status === "taken" || log.status === "skipped") &&
            Math.abs(new Date(log.scheduled_for).getTime() - at.getTime()) <= LOGGED_WINDOW_MINUTES * 60 * 1000
        );
        if (logged) continue;
        const food = FOOD[item.with_food];
        planned.push({
          id: `dose:${item.id}:${date}T${time}`,
          kind: "dose",
          at,
          title: "Time for your medicine",
          body: options.showNames ? [medicineLabel(item), item.dose, food].filter(Boolean).join(" · ") : `Your ${time} dose is due. Tap to log it.`,
          data: { kind: "dose", item_id: item.id, scheduled_for: at.toISOString() },
        });
      }
    }
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

/** The hour of the day at which refill alerts and test reminders are shown (local time). */
export const REMINDER_HOUR = { refill: 9, followUp: 10 } as const;

/** The next local `hour`:00 that is still in the future (later today, otherwise tomorrow). */
export function nextOccurrenceOfHour(now: Date, hour: number): Date {
  const today = formatLocalDate(now);
  const at = atLocalTime(today, `${String(hour).padStart(2, "0")}:00`);
  return at.getTime() > now.getTime() + 5000 ? at : atLocalTime(addDays(today, 1), `${String(hour).padStart(2, "0")}:00`);
}

/**
 * One alert per medicine that is due for a refill (see `getRefillStatus`), at 9:00 the next morning
 * or today. Planning again on each app start repeats it until the pack is renewed.
 */
export function planRefillAlerts(
  items: (RefillItem & Pick<DbPrescriptionItem, "medicine_name" | "strength">)[],
  logs: Pick<DbDoseLog, "item_id" | "status">[],
  now: Date,
  options: TextOptions = {}
): PlannedNotification[] {
  const at = nextOccurrenceOfHour(now, REMINDER_HOUR.refill);
  const date = formatLocalDate(at);
  const planned: PlannedNotification[] = [];
  for (const item of items) {
    const status = getRefillStatus(item, logs, now);
    if (!status.refill_due) continue;
    const left =
      status.units_left === 0 || status.days_left === 0
        ? "runs out today"
        : status.days_left === null
          ? "is running low"
          : `${status.days_left} day${status.days_left === 1 ? "" : "s"} left`;
    planned.push({
      id: `refill:${item.id}:${date}`,
      kind: "refill",
      at,
      title: "Time to reorder",
      body: options.showNames ? `${medicineLabel(item)}: ${left}. Tap to order it again.` : "A medicine is running low. Tap to see which and order it again.",
      data: { kind: "refill", item_id: item.id },
    });
  }
  return planned.slice(0, MAX_REFILL_ALERTS);
}

export type FollowUpTest = { test: string; every_days: number };

/** A test name reduced to lower-case letters and digits, so "HbA1c" and "Hb A1c" compare equal. */
function normaliseTestName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * When a care plan test was last measured. `lastDone` is keyed by the lab's own test name, which rarely
 * equals the plan's: "HbA1c" in the plan is "Glycated Haemoglobin (HbA1c)" in the report. Names match when
 * one contains the other (ignoring case, spaces and punctuation, at least 4 characters); the latest date wins.
 */
export function findLastDone(test: string, lastDone: Record<string, string>): string | null {
  const wanted = normaliseTestName(test);
  if (wanted.length < 4) return lastDone[test.trim().toLowerCase()] ?? null;
  let best: string | null = null;
  for (const [name, date] of Object.entries(lastDone)) {
    const key = normaliseTestName(name);
    if (key.length < 4) continue;
    if ((key === wanted || key.includes(wanted) || wanted.includes(key)) && (best === null || date > best)) best = date;
  }
  return best;
}

/**
 * A reminder for each follow-up test of an approved care plan. A test is due `every_days` after the
 * last time it was measured (`lastDone`, keyed by lower-case test name), or after the plan was
 * approved if it never was. A test that is already overdue is reminded at the next 10:00.
 */
export function planFollowUpReminders(
  planId: string,
  tests: FollowUpTest[],
  lastDone: Record<string, string>,
  approvedOn: string,
  now: Date,
  options: TextOptions = {}
): PlannedNotification[] {
  const today = formatLocalDate(now);
  const planned: PlannedNotification[] = [];
  // A notification id must be unique within the plan: two case-variants of one
  // test ("HbA1c", "HBA1C") used to share an id, so scheduling the second
  // replaced the first and one reminder was silently lost.
  const seenIds = new Map<string, number>();
  for (const { test, every_days } of tests) {
    if (!(every_days > 0)) continue;
    const base = findLastDone(test, lastDone) ?? approvedOn;
    const due = addDays(base, every_days);
    const dueAt = atLocalTime(due, `${String(REMINDER_HOUR.followUp).padStart(2, "0")}:00`);
    const at = due > today && dueAt.getTime() > now.getTime() ? dueAt : nextOccurrenceOfHour(now, REMINDER_HOUR.followUp);
    const baseId = `followup:${planId}:${test.trim().toLowerCase()}`;
    const count = (seenIds.get(baseId) ?? 0) + 1;
    seenIds.set(baseId, count);
    planned.push({
      id: count === 1 ? baseId : `${baseId}:${count}`,
      kind: "follow_up",
      at,
      title: "Time for a check-up test",
      body: options.showNames ? `${test} is due (your care plan suggests it every ${every_days} days).` : "A check-up test from your care plan is due.",
      data: { kind: "follow_up", plan_id: planId, test },
    });
  }
  return planned.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_FOLLOW_UPS);
}

/** All three kinds together, nearest first. */
export function sortPlanned(...lists: PlannedNotification[][]): PlannedNotification[] {
  return lists.flat().sort((a, b) => a.at.getTime() - b.at.getTime());
}
