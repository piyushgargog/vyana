import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istInstant, istTime, MISSED_DOSE_GRACE_MINUTES } from "@vyana/shared";
import { istDate } from "../dates";
import type { PushMessage, PushResult } from "../push";

/**
 * The medicine times in the database are wall-clock times in India (no daylight saving, UTC+5:30), and the
 * server runs in UTC, so a dose due at "09:00" is 03:30 UTC. The India-time conversions live in `@vyana/shared`.
 */
/** The caregiver alert goes out this many minutes after a dose was due (plan F11). */
export const GRACE_MINUTES = MISSED_DOSE_GRACE_MINUTES;

/**
 * A dose is still alerted this long after the grace period, so a cron run that was late or failed does not
 * lose it. Older doses are dropped: "Dad missed his dose this morning" at night is no help.
 */
export const CATCH_UP_MINUTES = 180;

/** A dose log counts for a due dose when it is for the same medicine and within this many minutes of it. */
const LOG_MATCH_MINUTES = 30;
const CHUNK = 100;
const MINUTE = 60_000;

export interface CareItem {
  id: string;
  patient_id: string;
  /** `HH:MM` (India time). */
  times: string[];
  start_date: string;
  end_date: string | null;
}

export interface DoseRef {
  item_id: string;
  scheduled_for: string;
}

/** A dose log as the check reads it. Only `taken` and `skipped` mean the dose was handled; `missed` means it was not. */
export interface DoseLogRef extends DoseRef {
  status?: string | null;
}

export interface DueDose {
  item_id: string;
  patient_id: string;
  due: Date;
}

/**
 * Every dose that was due more than `GRACE_MINUTES` ago but not more than `GRACE_MINUTES + CATCH_UP_MINUTES`
 * ago, from the medicines' times and date range. As-needed medicines (no times) never come due.
 */
export function listOverdueDoses(items: CareItem[], now: Date): DueDose[] {
  const newest = now.getTime() - GRACE_MINUTES * MINUTE;
  const oldest = newest - CATCH_UP_MINUTES * MINUTE;
  const days = [istDate(new Date(oldest)), istDate(new Date(newest))];
  const out: DueDose[] = [];
  for (const date of [...new Set(days)]) {
    for (const item of items) {
      if (date < item.start_date || (item.end_date && date > item.end_date)) continue;
      for (const time of item.times) {
        const due = istInstant(date, time);
        if (due.getTime() > oldest && due.getTime() <= newest) out.push({ item_id: item.id, patient_id: item.patient_id, due });
      }
    }
  }
  return out;
}

/**
 * Of the overdue doses, those that were not handled and not alerted yet. A dose is handled when the patient logged
 * it as `taken` or `skipped` within 30 minutes of its time; no log, or a log saying `missed`, leaves it open, so a
 * caregiver also hears about a dose the patient says they missed (decided by Piyush, 13 Oct). It was alerted when
 * a `missed_dose_alerts` row exists for exactly that medicine and time. `checked` is how many overdue doses were
 * looked at.
 */
export function findMissedDoses(
  items: CareItem[],
  logs: DoseLogRef[],
  alerts: DoseRef[],
  now: Date,
): { checked: number; missed: DueDose[] } {
  const overdue = listOverdueDoses(items, now);
  const alerted = new Set(alerts.map((a) => `${a.item_id}|${new Date(a.scheduled_for).getTime()}`));
  const missed = overdue.filter((dose) => {
    if (alerted.has(`${dose.item_id}|${dose.due.getTime()}`)) return false;
    return !logs.some(
      (log) =>
        log.status !== "missed" &&
        log.item_id === dose.item_id &&
        Math.abs(new Date(log.scheduled_for).getTime() - dose.due.getTime()) <= LOG_MATCH_MINUTES * MINUTE,
    );
  });
  return { checked: overdue.length, missed };
}

/** The first word of a name, or null: "Aryan Sharma" gives "Aryan". */
export function firstName(fullName: string | null | undefined): string | null {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first ? first : null;
}

const chunks = <T>(list: T[]): T[][] => Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

/** Runs a query for many ids, `CHUNK` ids per request (a long `in (...)` list overflows a URL), and joins the rows. */
async function readChunked<T>(ids: string[], query: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await query(part);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

export type PushSender = (messages: PushMessage[]) => Promise<PushResult>;

export interface MissedDoseResult {
  /** Overdue doses of patients with a caregiver that were looked at. */
  checked: number;
  /** Doses for which an alert was recorded and pushed to the caregivers (one count per dose, not per phone). */
  alerts_sent: number;
}

/**
 * The missed-dose check (plan 6.3, F11), run every 15 minutes: for patients with an active caregiver link, a dose
 * that was due 60+ minutes ago and has no dose log sends ONE push to each caregiver phone.
 *
 * "Once" is kept by recording the alert before sending: `missed_dose_alerts` has the primary key
 * (item_id, scheduled_for), so two runs at the same moment cannot both claim the same dose. A dose is claimed
 * only if a caregiver has a push token (otherwise it stays open until one registers, within the catch-up window),
 * and the claim is released if the push service cannot be reached, so the next run tries again.
 */
export async function runMissedDoseCheck(sb: SupabaseClient, send: PushSender, now: Date = new Date()): Promise<MissedDoseResult> {
  const { data: links, error: linkError } = await sb.from("care_links").select("patient_id, caregiver_id").eq("status", "active");
  if (linkError) throw linkError;
  if (!links || links.length === 0) return { checked: 0, alerts_sent: 0 };

  const caregiversOf = new Map<string, string[]>();
  for (const l of links as { patient_id: string; caregiver_id: string }[]) {
    caregiversOf.set(l.patient_id, [...(caregiversOf.get(l.patient_id) ?? []), l.caregiver_id]);
  }

  const items = (
    await readChunked<CareItem>([...caregiversOf.keys()], (part) =>
      sb.from("prescription_items").select("id, patient_id, times, start_date, end_date").in("patient_id", part).eq("active", true),
    )
  ).filter((i) => i.times.length > 0);

  const overdue = listOverdueDoses(items, now);
  if (overdue.length === 0) return { checked: 0, alerts_sent: 0 };

  const itemIds = [...new Set(overdue.map((d) => d.item_id))];
  const since = new Date(Math.min(...overdue.map((d) => d.due.getTime())) - LOG_MATCH_MINUTES * MINUTE).toISOString();
  const [logs, alerts] = await Promise.all([
    readChunked<DoseLogRef>(itemIds, (part) =>
      sb.from("dose_logs").select("item_id, scheduled_for, status").in("item_id", part).gte("scheduled_for", since),
    ),
    readChunked<DoseRef>(itemIds, (part) =>
      sb.from("missed_dose_alerts").select("item_id, scheduled_for").in("item_id", part).gte("scheduled_for", since),
    ),
  ]);

  const { checked, missed } = findMissedDoses(items, logs, alerts, now);
  if (missed.length === 0) return { checked, alerts_sent: 0 };

  // Who to tell: the phones of the patient's caregivers.
  const patientIds = [...new Set(missed.map((m) => m.patient_id))];
  const caregiverIds = [...new Set(patientIds.flatMap((p) => caregiversOf.get(p) ?? []))];
  const tokenRows = await readChunked<{ user_id: string; token: string }>(caregiverIds, (part) =>
    sb.from("push_tokens").select("user_id, token").in("user_id", part),
  );
  const tokensOf = (patientId: string) =>
    (caregiversOf.get(patientId) ?? []).flatMap((c) => tokenRows.filter((t) => t.user_id === c).map((t) => t.token));
  const reachable = missed.filter((m) => tokensOf(m.patient_id).length > 0);
  if (reachable.length === 0) return { checked, alerts_sent: 0 };

  // Claim before sending: only the run that inserts the row sends the push.
  const { data: claimedRows, error: claimError } = await sb
    .from("missed_dose_alerts")
    .upsert(
      reachable.map((m) => ({ item_id: m.item_id, scheduled_for: m.due.toISOString() })),
      { onConflict: "item_id,scheduled_for", ignoreDuplicates: true },
    )
    .select("item_id, scheduled_for");
  if (claimError) throw claimError;
  const claimedKeys = new Set((claimedRows ?? []).map((r: DoseRef) => `${r.item_id}|${new Date(r.scheduled_for).getTime()}`));
  const claimed = reachable.filter((m) => claimedKeys.has(`${m.item_id}|${m.due.getTime()}`));
  if (claimed.length === 0) return { checked, alerts_sent: 0 };

  const names = new Map<string, string>();
  const profiles = await readChunked<{ id: string; full_name: string | null }>(patientIds, (part) =>
    sb.from("profiles").select("id, full_name").in("id", part),
  );
  for (const p of profiles) if (firstName(p.full_name)) names.set(p.id, firstName(p.full_name) as string);

  // No medicine name, no condition and only the first name: a locked screen shows this text.
  const messages: PushMessage[] = claimed.flatMap((m) =>
    tokensOf(m.patient_id).map((to) => ({
      to,
      title: "A dose was missed",
      body: `${names.get(m.patient_id) ?? "Someone you look after"} has not logged the ${istTime(m.due)} dose.`,
      data: { kind: "missed_dose", patient_id: m.patient_id, item_id: m.item_id, scheduled_for: m.due.toISOString() },
      channelId: "caregiver-alerts",
    })),
  );

  let pushed: PushResult;
  try {
    pushed = await send(messages);
  } catch (error) {
    // Could not reach the push service: give the doses back so the next run tries again.
    for (const m of claimed) {
      await sb.from("missed_dose_alerts").delete().eq("item_id", m.item_id).eq("scheduled_for", m.due.toISOString());
    }
    throw error;
  }

  if (pushed.invalidTokens.length > 0) {
    await sb.from("push_tokens").delete().in("token", pushed.invalidTokens);
  }
  if (pushed.sent === 0) {
    // The push service answered but delivered nothing (every ticket failed or every token was dead): no caregiver was
    // told. Give the doses back so the next run tries again instead of counting a silent failure as an alert.
    for (const m of claimed) {
      await sb.from("missed_dose_alerts").delete().eq("item_id", m.item_id).eq("scheduled_for", m.due.toISOString());
    }
    return { checked, alerts_sent: 0 };
  }
  return { checked, alerts_sent: claimed.length };
}
