import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTimeline, type ShareRes, type TimelineSources } from "@vyana/shared";
import { notFound } from "../errors";
import { istDate } from "./missed-doses";

/** `share_links.token` is 24 random bytes as hex. Anything else cannot be a token, so it never reaches the database. */
export const SHARE_TOKEN_FORMAT = /^[0-9a-f]{48}$/;

/** One answer for every reason (no such link, turned off, expired), so nobody can probe which tokens once existed. */
const GONE = "This link has expired or was turned off.";

/** The most rows read from each table for a timeline link. */
const TIMELINE_ROWS = 100;
const TIMELINE_ENTRIES = 100;

/**
 * Age in whole years from a `YYYY-MM-DD` date of birth, or null if there is none. The day is the day in India
 * (the server runs in UTC), so a birthday counts from midnight in India, not from 05:30 in the morning.
 */
export function ageFromDob(dob: string | null, now: Date): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const [ty, tm, td] = istDate(now).split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age--;
  return age >= 0 ? age : null;
}

interface LinkRow {
  patient_id: string;
  kind: "medical_id" | "timeline";
  expires_at: string;
  revoked: boolean;
}

/** Runs a query and returns its rows typed as `T` (the service client has no table types, so an embedded `hospitals(name)` is checked by the tests). */
async function rows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}

/**
 * The read-only record behind a share link (`GET /api/share/[token]`, no sign-in). The link is the proof: it
 * must exist, not be turned off and not be past `expires_at`, otherwise this throws a 404.
 *
 * - `medical_id`: the basics a first responder needs (name, age, blood group, allergies, active conditions and
 *   medicines, emergency contacts). No timeline.
 * - `timeline`: the same basics for context, but no emergency contacts (a doctor does not need them), and the
 *   merged history of prescriptions, reports, appointments and conditions, newest first.
 *
 * It uses the service-role client, so it only ever reads for the patient named in the link row.
 */
export async function loadSharedRecord(sb: SupabaseClient, token: string, now: Date = new Date()): Promise<ShareRes> {
  if (!SHARE_TOKEN_FORMAT.test(token)) throw notFound(GONE);

  const { data: link, error: linkError } = await sb
    .from("share_links")
    .select("patient_id, kind, expires_at, revoked")
    .eq("token", token)
    .maybeSingle();
  if (linkError) throw linkError;
  const row = link as LinkRow | null;
  if (!row || row.revoked || new Date(row.expires_at).getTime() <= now.getTime()) throw notFound(GONE);

  const patient = row.patient_id;
  const today = istDate(now);

  const [profile, conditions, items, contacts] = await Promise.all([
    rows<{ full_name: string | null; dob: string | null; blood_group: string | null; allergies: string[] | null }>(
      sb.from("profiles").select("full_name, dob, blood_group, allergies").eq("id", patient),
    ),
    rows<{ name: string }>(sb.from("conditions").select("name").eq("patient_id", patient).eq("active", true).order("created_at")),
    rows<{ medicine_name: string; strength: string | null; dose: string | null; frequency: string; end_date: string | null }>(
      sb.from("prescription_items").select("medicine_name, strength, dose, frequency, end_date").eq("patient_id", patient).eq("active", true).order("created_at"),
    ),
    row.kind === "medical_id"
      ? rows<{ name: string; phone: string }>(sb.from("emergency_contacts").select("name, phone").eq("patient_id", patient).order("created_at"))
      : Promise.resolve([] as { name: string; phone: string }[]),
  ]);

  const p = profile[0];
  const res: ShareRes = {
    kind: row.kind,
    profile: {
      full_name: p?.full_name ?? null,
      age: ageFromDob(p?.dob ?? null, now),
      blood_group: p?.blood_group ?? null,
      allergies: p?.allergies ?? [],
      conditions: conditions.map((c) => c.name),
      active_medicines: items
        .filter((i) => !i.end_date || i.end_date >= today)
        .map((i) => ({ name: i.medicine_name, strength: i.strength, dose: i.dose, frequency: i.frequency })),
      emergency_contacts: contacts.map((c) => ({ name: c.name, phone: c.phone })),
    },
    timeline: null,
    memory: null, // filled by the Memory Graph data work (M1)
    expires_at: new Date(row.expires_at).toISOString(),
  };

  if (row.kind === "timeline") {
    const [prescriptions, reports, appointments, timelineConditions] = await Promise.all([
      rows<TimelineSources["prescriptions"][number]>(
        sb.from("prescriptions").select("id, issued_on, diagnosis, doctor_name, source").eq("patient_id", patient).order("issued_on", { ascending: false }).limit(TIMELINE_ROWS),
      ),
      rows<TimelineSources["reports"][number]>(
        sb.from("lab_reports").select("id, report_date, created_at, lab_name, summary").eq("patient_id", patient).order("created_at", { ascending: false }).limit(TIMELINE_ROWS),
      ),
      rows<TimelineSources["appointments"][number]>(
        sb
          .from("appointments")
          .select("id, appointment_date, token_no, status, reason, hospitals(name), departments(name)")
          .eq("patient_id", patient)
          .order("appointment_date", { ascending: false })
          .limit(TIMELINE_ROWS),
      ),
      rows<TimelineSources["conditions"][number]>(
        sb.from("conditions").select("id, diagnosed_on, created_at, name, source").eq("patient_id", patient).order("created_at", { ascending: false }).limit(TIMELINE_ROWS),
      ),
    ]);
    res.timeline = buildTimeline({ prescriptions, reports, appointments, conditions: timelineConditions })
      .slice(0, TIMELINE_ENTRIES)
      .map((e) => ({ date: e.date, kind: e.kind, title: e.title, summary: e.subtitle }));
  }
  return res;
}
