import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istDate } from "../dates";
import type { PushMessage, PushResult } from "../push";
import {
  firstName,
  istInstant,
  istTime,
  readChunked,
  type CareItem,
  type DoseLogRef,
  type DueDose,
  type PushSender,
} from "./missed-doses";

/**
 * The late-dose nudge (issue #495 step 3), run inside the missed-dose cron's 15-minute pass:
 * a dose more than 30 minutes old with no log earns the PATIENT one push; if the slot is
 * still open at 90 minutes, the patient has the "Late dose nudge" switch on and a caregiver
 * is linked, the caregivers get one message. `late_dose_pushes` (one row per medicine and
 * slot) is what makes each of those happen once: the patient push is claimed by inserting
 * the row before sending (given back when nothing was delivered), the caregiver message by
 * stamping `caregiver_sent_at` after a successful send.
 */

export const LATE_MINUTES = 30;
export const CAREGIVER_LATE_MINUTES = 90;
/** A slot stops being nudged this long after the patient mark; an old dose is not news. */
export const LATE_CATCH_UP_MINUTES = 180;

const LOG_MATCH_MINUTES = 30;
const MINUTE = 60_000;
const PAGE = 200;

export interface LatePushRef {
  item_id: string;
  scheduled_for: string;
  caregiver_sent_at: string | null;
}

export interface LateSelection {
  /** Slots in the late window that were looked at. */
  checked: number;
  /** Unlogged slots the patient has not been nudged about yet. */
  patientDue: DueDose[];
  /** Unlogged slots 90+ minutes old, nudged to the patient, not yet told to a caregiver. */
  caregiverDue: DueDose[];
}

/** Every dose due on the IST days the late window touches, from the medicines' times and range. */
function listLateDoses(items: CareItem[], now: Date): DueDose[] {
  const newest = now.getTime() - LATE_MINUTES * MINUTE;
  const oldest = newest - LATE_CATCH_UP_MINUTES * MINUTE;
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
 * Which late slots still need a nudge. Handled is the missed-dose rule: a log of taken or
 * skipped within 30 minutes of the slot; a log saying missed leaves the slot open.
 */
export function findLateDoses(items: CareItem[], logs: DoseLogRef[], pushes: LatePushRef[], now: Date): LateSelection {
  const late = listLateDoses(items, now);
  const open = late.filter(
    (dose) =>
      !logs.some(
        (log) =>
          log.status !== "missed" &&
          log.item_id === dose.item_id &&
          Math.abs(new Date(log.scheduled_for).getTime() - dose.due.getTime()) <= LOG_MATCH_MINUTES * MINUTE,
      ),
  );
  const byKey = new Map(pushes.map((p) => [`${p.item_id}|${new Date(p.scheduled_for).getTime()}`, p]));
  const patientDue = open.filter((d) => !byKey.has(`${d.item_id}|${d.due.getTime()}`));
  const caregiverDue = open.filter((d) => {
    const row = byKey.get(`${d.item_id}|${d.due.getTime()}`);
    return row !== undefined && row.caregiver_sent_at === null && now.getTime() - d.due.getTime() >= CAREGIVER_LATE_MINUTES * MINUTE;
  });
  return { checked: late.length, patientDue, caregiverDue };
}

export interface LateDoseResult {
  checked: number;
  /** Doses for which a nudge was recorded and pushed to the patient (one count per dose). */
  patient_sent: number;
  /** Doses escalated to the patient's caregivers at 90 minutes (one count per dose). */
  caregiver_sent: number;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  late_dose_nudge: boolean;
}

/** Every profile, one page at a time (keyset on id), with the nudge switch and the name. */
async function readProfiles(sb: SupabaseClient): Promise<ProfileRow[]> {
  const out: ProfileRow[] = [];
  let cursor = "";
  for (let page = 0; page < 100; page++) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, full_name, late_dose_nudge")
      .order("id")
      .gt("id", cursor)
      .limit(PAGE);
    if (error) throw error;
    const rows = (data ?? []) as ProfileRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1].id;
  }
  return out;
}

export async function runLateDoseCheck(sb: SupabaseClient, send: PushSender, now: Date = new Date()): Promise<LateDoseResult> {
  const profiles = await readProfiles(sb);
  if (profiles.length === 0) return { checked: 0, patient_sent: 0, caregiver_sent: 0 };
  const profileOf = new Map(profiles.map((p) => [p.id, p]));

  const items = (
    await readChunked<CareItem>(
      profiles.map((p) => p.id),
      (part) => sb.from("prescription_items").select("id, patient_id, times, start_date, end_date").in("patient_id", part).eq("active", true),
    )
  ).filter((i) => i.times.length > 0);
  const late = listLateDoses(items, now);
  if (late.length === 0) return { checked: 0, patient_sent: 0, caregiver_sent: 0 };

  const itemIds = [...new Set(late.map((d) => d.item_id))];
  const since = new Date(Math.min(...late.map((d) => d.due.getTime())) - LOG_MATCH_MINUTES * MINUTE).toISOString();
  const [logs, pushes] = await Promise.all([
    readChunked<DoseLogRef>(itemIds, (part) => sb.from("dose_logs").select("item_id, scheduled_for, status").in("item_id", part).gte("scheduled_for", since)),
    readChunked<LatePushRef>(itemIds, (part) =>
      sb.from("late_dose_pushes").select("item_id, scheduled_for, caregiver_sent_at").in("item_id", part).gte("scheduled_for", since),
    ),
  ]);
  const { checked, patientDue, caregiverDue } = findLateDoses(items, logs, pushes, now);

  const userIds = [...new Set([...patientDue.map((d) => d.patient_id), ...caregiverDue.map((d) => d.patient_id)])];
  const links = userIds.length === 0 ? [] : await readChunked<{ patient_id: string; caregiver_id: string }>(userIds, (part) => sb.from("care_links").select("patient_id, caregiver_id").in("patient_id", part).eq("status", "active"));
  const caregiversOf = new Map<string, string[]>();
  for (const l of links) caregiversOf.set(l.patient_id, [...(caregiversOf.get(l.patient_id) ?? []), l.caregiver_id]);

  const tokenUserIds = [...new Set([...userIds, ...links.map((l) => l.caregiver_id)])];
  const tokenRows = tokenUserIds.length === 0 ? [] : await readChunked<{ user_id: string; token: string }>(tokenUserIds, (part) => sb.from("push_tokens").select("user_id, token").in("user_id", part));
  const tokensOf = (userId: string) => tokenRows.filter((t) => t.user_id === userId).map((t) => t.token);
  const giveBack = async (rows: DueDose[]) => {
    for (const m of rows) await sb.from("late_dose_pushes").delete().eq("item_id", m.item_id).eq("scheduled_for", m.due.toISOString());
  };
  const cleanInvalid = async (pushed: PushResult) => {
    if (pushed.invalidTokens.length > 0) await sb.from("push_tokens").delete().in("token", pushed.invalidTokens);
  };

  // ---- The patient nudge: claim the slot, then push the patient's own phones.
  let patientSent = 0;
  const reachable = patientDue.filter((d) => tokensOf(d.patient_id).length > 0);
  if (reachable.length > 0) {
    const { data: claimedRows, error: claimError } = await sb
      .from("late_dose_pushes")
      .upsert(
        reachable.map((m) => ({ patient_id: m.patient_id, item_id: m.item_id, scheduled_for: m.due.toISOString() })),
        { onConflict: "item_id,scheduled_for", ignoreDuplicates: true },
      )
      .select("item_id, scheduled_for");
    if (claimError) throw claimError;
    const claimedKeys = new Set((claimedRows ?? []).map((r: { item_id: string; scheduled_for: string }) => `${r.item_id}|${new Date(r.scheduled_for).getTime()}`));
    const claimed = reachable.filter((m) => claimedKeys.has(`${m.item_id}|${m.due.getTime()}`));
    if (claimed.length > 0) {
      const messages: PushMessage[] = claimed.flatMap((m) =>
        tokensOf(m.patient_id).map((to) => ({
          to,
          title: "Dose reminder",
          body: `Your ${istTime(m.due)} dose is not logged yet.`,
          data: { type: "dose_late", itemId: m.item_id, scheduledFor: m.due.toISOString() },
          channelId: "doses",
        })),
      );
      let pushed: PushResult;
      try {
        pushed = await send(messages);
      } catch (error) {
        await giveBack(claimed);
        throw error;
      }
      await cleanInvalid(pushed);
      if (pushed.sent === 0) {
        await giveBack(claimed);
      } else {
        patientSent = claimed.length;
      }
    }
  }

  // ---- The caregiver escalation at 90 minutes, only where the patient's switch is on.
  let caregiverSent = 0;
  const escalate = caregiverDue.filter(
    (d) => profileOf.get(d.patient_id)?.late_dose_nudge === true && (caregiversOf.get(d.patient_id) ?? []).some((c) => tokensOf(c).length > 0),
  );
  if (escalate.length > 0) {
    const messages: PushMessage[] = escalate.flatMap((m) =>
      (caregiversOf.get(m.patient_id) ?? []).flatMap((c) =>
        tokensOf(c).map((to) => ({
          to,
          title: "A dose is still not logged",
          body: `${firstName(profileOf.get(m.patient_id)?.full_name) ?? "Someone you look after"} has still not logged the ${istTime(m.due)} dose.`,
          data: { kind: "dose_late", patient_id: m.patient_id, item_id: m.item_id, scheduled_for: m.due.toISOString() },
          channelId: "caregiver-alerts",
        })),
      ),
    );
    let pushed: PushResult;
    try {
      pushed = await send(messages);
    } catch {
      // The escalation is a courtesy copy of a dose the missed-dose check also covers;
      // a failed send simply leaves the slot unstamped, so a later run can try again.
      pushed = { sent: 0, failed: messages.length, invalidTokens: [] };
    }
    await cleanInvalid(pushed);
    if (pushed.sent > 0) {
      for (const m of escalate) {
        const { error } = await sb
          .from("late_dose_pushes")
          .update({ caregiver_sent_at: now.toISOString() })
          .eq("item_id", m.item_id)
          .eq("scheduled_for", m.due.toISOString());
        if (error) throw error;
      }
      caregiverSent = escalate.length;
    }
  }

  return { checked, patient_sent: patientSent, caregiver_sent: caregiverSent };
}
