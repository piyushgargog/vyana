// packages/shared/src/db/queries/doses.ts
// Owner: Vaibhav Parmar

import { MISSED_DOSE_GRACE_MINUTES } from "../../constants";
import type { DbDoseLog, DbPrescriptionItem } from "../types";
import { daysAgoIso, requireUserId, toLocalDate, unwrap, type Sb } from "./helpers";

export type DoseStatus = "taken" | "missed" | "skipped";

export type LogDoseInput = {
  item_id: string;
  /** The time the dose was due, as an ISO timestamp. Logging the same dose again updates it. */
  scheduled_for: string;
  status: DoseStatus;
};

export type Adherence = { taken: number; missed: number; percent: number };

/** The fields of a medicine that decide when its doses are due. */
export type ScheduledItem = Pick<DbPrescriptionItem, "id" | "times" | "start_date" | "end_date">;

/** A logged dose is matched to a due dose when it is for the same medicine and within this many minutes. */
const MATCH_WINDOW_MINUTES = 30;

/** Records a dose as taken, missed or skipped. One row per medicine and due time. */
export async function logDose(sb: Sb, input: LogDoseInput): Promise<DbDoseLog> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("dose_logs")
      .upsert(
        { patient_id: patientId, item_id: input.item_id, scheduled_for: input.scheduled_for, status: input.status, logged_at: new Date().toISOString() },
        { onConflict: "item_id,scheduled_for" }
      )
      .select()
      .single()
  );
}

/** Dose logs due between `from` and `to` (ISO timestamps, `to` excluded), oldest first. */
export async function listDoseLogs(sb: Sb, from: string, to: string): Promise<DbDoseLog[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("dose_logs").select("*").eq("patient_id", patientId).gte("scheduled_for", from).lt("scheduled_for", to).order("scheduled_for")
  );
}

/** Every dose log of the given medicines (all time), for the refill count and to skip reminders of doses already logged. */
export async function listItemDoseLogs(sb: Sb, itemIds: string[]): Promise<Pick<DbDoseLog, "item_id" | "scheduled_for" | "status">[]> {
  if (itemIds.length === 0) return [];
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("dose_logs").select("item_id, scheduled_for, status").eq("patient_id", patientId).in("item_id", itemIds));
}

/**
 * Share of doses taken among the doses that were taken or missed. A skipped dose is a choice, so it
 * is left out; with nothing logged the percentage is 0.
 */
export function computeAdherence(logs: Pick<DbDoseLog, "status">[]): Adherence {
  const taken = logs.filter((l) => l.status === "taken").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const due = taken + missed;
  return { taken, missed, percent: due === 0 ? 0 : Math.round((taken / due) * 100) };
}

/**
 * The doses that were due between `from` and `now` and are overdue by more than the grace period
 * (`MISSED_DOSE_GRACE_MINUTES`), from the medicines' times (local time, `HH:MM`) and date range.
 * As-needed medicines (no times) never come due.
 */
export function listDueDoses(items: ScheduledItem[], from: Date, now: Date, graceMinutes: number = MISSED_DOSE_GRACE_MINUTES): { item_id: string; due: Date }[] {
  const due: { item_id: string; due: Date }[] = [];
  const lastDue = now.getTime() - graceMinutes * 60 * 1000;
  for (let day = new Date(from.getFullYear(), from.getMonth(), from.getDate()); day.getTime() <= now.getTime(); day.setDate(day.getDate() + 1)) {
    const date = toLocalDate(day);
    for (const item of items) {
      if (date < item.start_date || (item.end_date && date > item.end_date)) continue;
      for (const time of item.times) {
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(time.slice(0, 2)), Number(time.slice(3, 5)));
        if (at.getTime() >= from.getTime() && at.getTime() <= lastDue) due.push({ item_id: item.id, due: at });
      }
    }
  }
  return due;
}

/**
 * Adherence that counts a dose nobody logged as missed once it is overdue. A patient who never
 * opens the app must not look 100% adherent. Logged doses count as logged; a due dose with a log
 * of the same medicine within 30 minutes is not counted twice.
 */
export function computeScheduledAdherence(
  items: ScheduledItem[],
  logs: Pick<DbDoseLog, "item_id" | "scheduled_for" | "status">[],
  from: Date,
  now: Date,
  graceMinutes: number = MISSED_DOSE_GRACE_MINUTES
): Adherence {
  const used = new Set<number>();
  let unlogged = 0;
  for (const { item_id, due } of listDueDoses(items, from, now, graceMinutes)) {
    const index = logs.findIndex(
      (log, i) => !used.has(i) && log.item_id === item_id && Math.abs(new Date(log.scheduled_for).getTime() - due.getTime()) <= MATCH_WINDOW_MINUTES * 60 * 1000
    );
    if (index === -1) unlogged++;
    else used.add(index);
  }
  const counted = computeAdherence(logs);
  const missed = counted.missed + unlogged;
  const total = counted.taken + missed;
  return { taken: counted.taken, missed, percent: total === 0 ? 0 : Math.round((counted.taken / total) * 100) };
}

/**
 * Adherence over the last `days` days, counting doses that were due and never logged as missed.
 * Only medicines that are switched on now are scheduled: a dose that was due while a medicine was on and
 * missed before it was switched off is not counted, because the database keeps no history of that switch.
 */
export async function getAdherence(sb: Sb, days: number, now: Date = new Date()): Promise<Adherence> {
  const patientId = await requireUserId(sb);
  const from = new Date(daysAgoIso(days, now));
  const [logs, items] = await Promise.all([
    listDoseLogs(sb, from.toISOString(), now.toISOString()),
    sb.from("prescription_items").select("id, times, start_date, end_date").eq("patient_id", patientId).eq("active", true),
  ]);
  return computeScheduledAdherence(unwrap(items), logs, from, now);
}
