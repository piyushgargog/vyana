import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMemory,
  buildTimeline,
  isShareScope,
  MEMORY_LAB_POINTS,
  MEMORY_LAB_TESTS,
  type MemoryDoseLog,
  type MemoryLabValue,
  type MemoryVital,
  type PrescriptionItem,
  type ShareRes,
  type ShareScope,
  type TimelineSources,
} from "@vyana/shared";
import { notFound } from "../errors";
import { istDate } from "../dates";

/** `share_links.token` is 24 random bytes as hex. Anything else cannot be a token, so it never reaches the database. */
export const SHARE_TOKEN_FORMAT = /^[0-9a-f]{48}$/;

/** One answer for every reason (no such link, turned off, expired), so nobody can probe which tokens once existed. */
const GONE = "This link has expired or was turned off.";

/** The most rows read from each table for a timeline link. */
const TIMELINE_ROWS = 100;
const TIMELINE_ENTRIES = 100;

/** The caps of the memory fetches (#237): per lab test the graph's own point cap; the vital and dose fetches are generous bounds the pure builder then windows. */
const MEMORY_VITAL_ROWS = 1000;
const MEMORY_DOSE_ROWS = 1000;

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
  scopes: string[] | null;
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
 * A timeline link created with scopes (#237) also returns its Health Memory Graph: only the sections named
 * in the scopes are read (capped parallel queries) and built, the rest stay out. A medical ID
 * link never carries it. Every successful
 * open is counted on the link (`open_count`, `last_opened_at`) so the patient can see it was used;
 * a failure of that write never breaks the page, and nothing about the viewer is stored.
 *
 * It uses the service-role client, so it only ever reads for the patient named in the link row.
 */
export async function loadSharedRecord(sb: SupabaseClient, token: string, now: Date = new Date()): Promise<ShareRes> {
  if (!SHARE_TOKEN_FORMAT.test(token)) throw notFound(GONE);

  const { data: link, error: linkError } = await sb
    .from("share_links")
    .select("patient_id, kind, expires_at, revoked, scopes")
    .eq("token", token)
    .maybeSingle();
  if (linkError) throw linkError;
  const row = link as LinkRow | null;
  if (!row || row.revoked || new Date(row.expires_at).getTime() <= now.getTime()) throw notFound(GONE);

  const patient = row.patient_id;
  const today = istDate(now);
  const scopes: ShareScope[] = (row.scopes ?? []).filter(isShareScope);

  const [profile, conditions, items, contacts] = await Promise.all([
    rows<{ full_name: string | null; dob: string | null; blood_group: string | null; allergies: string[] | null }>(
      sb.from("profiles").select("full_name, dob, blood_group, allergies").eq("id", patient),
    ),
    rows<{ name: string }>(sb.from("conditions").select("name").eq("patient_id", patient).eq("active", true).order("created_at")),
    rows<{ medicine_name: string; strength: string | null; dose: string | null; frequency: PrescriptionItem["frequency"]; start_date: string | null; end_date: string | null; created_at: string }>(
      sb.from("prescription_items").select("medicine_name, strength, dose, frequency, start_date, end_date, created_at").eq("patient_id", patient).eq("active", true).order("created_at"),
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
    memory: null,
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

  // The memory belongs to the timeline record only: a medical ID link is the emergency card a
  // first responder reads, and it never carries the long view, whatever scopes it was given.
  if (row.kind === "timeline" && scopes.length > 0) {
    // Only the scopes that are on are read, in parallel, each capped; buildMemory applies the
    // windows (labs 24 months, vitals 12, adherence 30 days). The medicines are the active items
    // already read for the profile, so that scope needs no query of its own.
    const doseWindowStart = new Date(new Date(`${today}T00:00:00+05:30`).getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
    const [labs, vitals, doseLogs] = await Promise.all([
      scopes.includes("labs") ? fetchLabs(sb, patient) : Promise.resolve([] as MemoryLabValue[]),
      scopes.includes("vitals")
        ? rows<MemoryVital>(
            sb.from("vitals").select("type, value, value2, unit, measured_at").eq("patient_id", patient).order("measured_at", { ascending: false }).limit(MEMORY_VITAL_ROWS),
          )
        : Promise.resolve([] as MemoryVital[]),
      scopes.includes("adherence")
        ? rows<MemoryDoseLog>(
            sb
              .from("dose_logs")
              .select("scheduled_for, status")
              .eq("patient_id", patient)
              .gte("scheduled_for", doseWindowStart)
              .order("scheduled_for", { ascending: false })
              .limit(MEMORY_DOSE_ROWS),
          )
        : Promise.resolve([] as MemoryDoseLog[]),
    ]);
    res.memory = buildMemory({ labs, vitals, medicines: items, adherence: doseLogs }, scopes, today);
  }

  // A successful open counts for the patient ("Opened N times"). The bump is one atomic
  // statement in the database (0014), so two opens at the same moment both count. Best effort
  // only: the count is a courtesy, so a failed write never breaks the page.
  try {
    await sb.rpc("bump_share_open", { p_token: token });
  } catch {
    // ignored on purpose, see above
  }
  return res;
}

/**
 * The lab rows of the memory, fetched per test: first the tests the patient measured most
 * recently (at most the graph's test cap), then each test's newest points (at most the point
 * cap). One shared newest-first fetch would let a single frequent test (a diabetic's glucose)
 * fill the whole cap and starve every other test out of the graph.
 */
async function fetchLabs(sb: SupabaseClient, patient: string): Promise<MemoryLabValue[]> {
  const recent = await rows<{ test_name: string }>(
    sb.from("lab_values").select("test_name").eq("patient_id", patient).order("measured_on", { ascending: false }).limit(MEMORY_VITAL_ROWS),
  );
  const names: string[] = [];
  for (const r of recent) {
    if (!names.includes(r.test_name)) names.push(r.test_name);
    if (names.length === MEMORY_LAB_TESTS) break;
  }
  const perTest = await Promise.all(
    names.map((name) =>
      rows<MemoryLabValue>(
        sb
          .from("lab_values")
          .select("test_name, value, unit, flag, ref_low, ref_high, measured_on")
          .eq("patient_id", patient)
          .eq("test_name", name)
          .order("measured_on", { ascending: false })
          .limit(MEMORY_LAB_POINTS),
      ),
    ),
  );
  return perTest.flat();
}
