import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istDayOf } from "@vyana/shared";
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
 * slot) is what makes each of those happen once: each send is CLAIMED before it goes out —
 * the patient claim stamps `sent_at`, the caregiver claim stamps `caregiver_sent_at`, and
 * either claim is given back when nothing was delivered, so a later run can retry. The two
 * claims are independent: the escalation does not need the patient push to have happened
 * (a patient with no phone token still has caregivers worth telling at 90 minutes).
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
  /** When the patient claim was taken; null on a row only the escalation has claimed. */
  sent_at: string | null;
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
  const days = [istDayOf(new Date(oldest).toISOString()), istDayOf(new Date(newest).toISOString())];
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
  // The patient is due a nudge until the patient claim is stamped — a row the escalation
  // claimed on its own (sent_at still null) does not count as the patient being told.
  const patientDue = open.filter((d) => {
    const row = byKey.get(`${d.item_id}|${d.due.getTime()}`);
    return row === undefined || row.sent_at === null;
  });
  // The caregivers are due at 90 minutes until the caregiver claim is stamped, whether or
  // not the patient push ever happened.
  const caregiverDue = open.filter((d) => {
    const row = byKey.get(`${d.item_id}|${d.due.getTime()}`);
    return (row === undefined || row.caregiver_sent_at === null) && now.getTime() - d.due.getTime() >= CAREGIVER_LATE_MINUTES * MINUTE;
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
      sb.from("late_dose_pushes").select("item_id, scheduled_for, sent_at, caregiver_sent_at").in("item_id", part).gte("scheduled_for", since),
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
  const cleanInvalid = async (pushed: PushResult) => {
    if (pushed.invalidTokens.length > 0) await sb.from("push_tokens").delete().in("token", pushed.invalidTokens);
  };

  // Claims. Each send is claimed BEFORE it goes out, per dose, so the claim's granularity
  // matches the send result's: a dose is counted only when its own messages were delivered.
  // A claim either inserts the slot's row with its stamp set, or — when the other claim got
  // there first and this stamp is still empty — flips the stamp on the existing row, guarded
  // by the stamp still being null so two overlapping runs cannot both win. Releasing undoes
  // exactly the claim this run took.
  const pushByKey = new Map(pushes.map((p) => [`${p.item_id}|${new Date(p.scheduled_for).getTime()}`, p]));
  type Stamp = "sent_at" | "caregiver_sent_at";
  const claim = async (dose: DueDose, stamp: Stamp): Promise<"inserted" | "updated" | null> => {
    const existing = pushByKey.get(`${dose.item_id}|${dose.due.getTime()}`);
    if (!existing) {
      const { data, error } = await sb
        .from("late_dose_pushes")
        .upsert([{ patient_id: dose.patient_id, item_id: dose.item_id, scheduled_for: dose.due.toISOString(), [stamp]: now.toISOString() }], {
          onConflict: "item_id,scheduled_for",
          ignoreDuplicates: true,
        })
        .select("item_id");
      if (error) throw error;
      return data && data.length > 0 ? "inserted" : null;
    }
    if (existing[stamp] !== null) return null;
    const { data, error } = await sb
      .from("late_dose_pushes")
      .update({ [stamp]: now.toISOString() })
      .eq("item_id", dose.item_id)
      .eq("scheduled_for", dose.due.toISOString())
      .is(stamp, null)
      .select("item_id");
    if (error) throw error;
    return data && data.length > 0 ? "updated" : null;
  };
  const release = async (dose: DueDose, stamp: Stamp, how: "inserted" | "updated") => {
    if (how === "inserted") {
      // Guarded like the update below: the row goes only while the other claim
      // is still empty and this stamp is still this run's — an overlapping run
      // may have claimed the other send on this same row and delivered it, and
      // deleting the row would erase that claim and send that message again.
      const other: Stamp = stamp === "sent_at" ? "caregiver_sent_at" : "sent_at";
      await sb
        .from("late_dose_pushes")
        .delete()
        .eq("item_id", dose.item_id)
        .eq("scheduled_for", dose.due.toISOString())
        .eq(stamp, now.toISOString())
        .is(other, null);
    } else {
      await sb
        .from("late_dose_pushes")
        .update({ [stamp]: null })
        .eq("item_id", dose.item_id)
        .eq("scheduled_for", dose.due.toISOString())
        .eq(stamp, now.toISOString());
    }
  };
  /** Sends one dose's messages under its claim; true only when something was delivered. */
  const sendClaimed = async (dose: DueDose, stamp: Stamp, messages: PushMessage[]): Promise<boolean> => {
    const how = await claim(dose, stamp);
    if (!how) return false;
    let pushed: PushResult;
    try {
      pushed = await send(messages);
    } catch {
      await release(dose, stamp, how);
      return false;
    }
    await cleanInvalid(pushed);
    if (pushed.sent === 0) {
      await release(dose, stamp, how);
      return false;
    }
    return true;
  };

  // ---- The patient nudge: one claim and one send per dose, to the patient's own phones.
  let patientSent = 0;
  for (const dose of patientDue) {
    const tokens = tokensOf(dose.patient_id);
    if (tokens.length === 0) continue;
    const messages: PushMessage[] = tokens.map((to) => ({
      to,
      title: "Dose reminder",
      body: `Your ${istTime(dose.due)} dose is not logged yet.`,
      data: { type: "dose_late", itemId: dose.item_id, scheduledFor: dose.due.toISOString() },
      channelId: "doses",
    }));
    if (await sendClaimed(dose, "sent_at", messages)) patientSent++;
  }

  // ---- The caregiver escalation at 90 minutes, only where the patient's switch is on.
  // Independent of the patient path: no patient token and no patient claim are required.
  let caregiverSent = 0;
  for (const dose of caregiverDue) {
    if (profileOf.get(dose.patient_id)?.late_dose_nudge !== true) continue;
    const messages: PushMessage[] = (caregiversOf.get(dose.patient_id) ?? []).flatMap((c) =>
      tokensOf(c).map((to) => ({
        to,
        title: "A dose is still not logged",
        body: `${firstName(profileOf.get(dose.patient_id)?.full_name) ?? "Someone you look after"} has still not logged the ${istTime(dose.due)} dose.`,
        data: { kind: "dose_late", patient_id: dose.patient_id, item_id: dose.item_id, scheduled_for: dose.due.toISOString() },
        channelId: "caregiver-alerts",
      })),
    );
    if (messages.length === 0) continue;
    if (await sendClaimed(dose, "caregiver_sent_at", messages)) caregiverSent++;
  }

  return { checked, patient_sent: patientSent, caregiver_sent: caregiverSent };
}
