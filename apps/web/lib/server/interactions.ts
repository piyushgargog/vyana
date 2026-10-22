import "server-only";
import { createHash } from "node:crypto";
import type { AiMeta, Interaction, InteractionsReq, InteractionsRes, SourceLink } from "@vyana/shared";
import type { AuthedUser } from "./auth";
import { badRequest, forbidden } from "./errors";
import { log } from "./log";
import { saltsFor } from "./safety/brand-salts";
import { TABLE_ADVICE, lookupInteractions } from "./safety/interactions-table";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Medicine interaction check (SPEC section 14, PLAN section 2A, ADR-033, ADR-072): brand to salt from the curated list, then
 * the reviewed table in code. A pair the table does not cover is listed as "not checked", never as "no interaction found":
 * an empty result never means "safe". (Until 22 Oct a second layer read passages from web pages and let a model confirm them;
 * it went with the web agent. A new source comes back only with the same quote-must-be-on-the-page rule.)
 */

const MAX_PAIRS = 15;
const RESULT_DAYS = 7;
export const INTERACTIONS_VERSION = "table@1";

interface Medicine {
  name: string;
  salts: string[];
}

const display = (r: { medicine_name: string; strength: string | null }) => (r.strength ? `${r.medicine_name} ${r.strength}` : r.medicine_name);
const meta = (): AiMeta => ({ model: "none", prompt_version: INTERACTIONS_VERSION, generated_at: new Date().toISOString() });
const joined = (m: Medicine) => m.salts.join(" + ");

/**
 * Whose medicines are checked: the patient themselves, or a patient of the calling doctor (ADR-061).
 * The caller is a patient or a doctor — the route checks the role; this only settles whose record it is.
 */
export async function patientFor({ sb, user, profile }: Pick<AuthedUser, "sb" | "user" | "profile">, body: InteractionsReq): Promise<string> {
  if (profile.role === "patient") {
    if (body.patient_id && body.patient_id !== user.id) throw forbidden();
    return user.id;
  }
  let patientId = body.patient_id;
  if (body.prescription_id) {
    // Read as the doctor: RLS hides prescriptions of other doctors' patients.
    const { data, error } = await sb.from("prescriptions").select("patient_id").eq("id", body.prescription_id).maybeSingle();
    if (error) throw error;
    const rx = data as { patient_id: string } | null;
    if (!rx || (patientId && patientId !== rx.patient_id)) throw forbidden();
    patientId = rx.patient_id;
  }
  if (!patientId) throw badRequest("Send prescription_id or patient_id.");
  const { data: isDoctor, error } = await sb.rpc("is_doctor_of", { p: patientId });
  if (error) throw error;
  if (isDoctor !== true) throw forbidden();
  return patientId;
}

export async function checkInteractions(authed: AuthedUser, body: InteractionsReq): Promise<InteractionsRes> {
  const { sb } = authed;
  const patientId = await patientFor(authed, body);

  // The patient's medicines, read through RLS (the patient's own, or a doctor's patient).
  const query = sb.from("prescription_items").select("medicine_name, strength").eq("patient_id", patientId);
  const { data, error } = await (body.prescription_id ? query.eq("prescription_id", body.prescription_id) : query.eq("active", true));
  if (error) throw error;
  const rows = (data ?? []) as { medicine_name: string; strength: string | null }[];

  const known: Medicine[] = [];
  const notChecked: string[] = [];
  for (const r of rows) {
    const name = display(r);
    if (known.some((m) => m.name === name)) continue;
    const match = saltsFor(r.medicine_name);
    if (match) known.push({ name, salts: match.salts });
    else if (!notChecked.includes(name)) notChecked.push(name);
  }

  // A saved result for the same medicines, less than a week old.
  const admin = supabaseAdmin();
  // SHA-256: the key is built from health data (medicine names).
  const medicinesKey = createHash("sha256").update(JSON.stringify(known.map((m) => `${m.name}|${m.salts.join("+")}`).sort())).digest("hex");
  const { data: saved } = await admin
    .from("interaction_checks")
    .select("id, result_json, created_at")
    .eq("patient_id", patientId)
    .eq("medicines_key", medicinesKey)
    .maybeSingle();
  const savedRow = saved as { id: string; result_json: InteractionsRes; created_at: string } | null;
  if (savedRow && Date.now() - new Date(savedRow.created_at).getTime() < RESULT_DAYS * 24 * 60 * 60 * 1000) {
    return { ...savedRow.result_json, not_checked: notChecked, cached: true };
  }

  // The reviewed table, in code.
  const tableHits = lookupInteractions(known.map(joined));
  const interactions: Interaction[] = tableHits.map((h) => {
    const [ia, ib] = h.medicines.map((s) => known.find((m) => joined(m) === s) as Medicine);
    return {
      medicine_a: ia.name,
      medicine_b: ib.name,
      severity: h.entry.severity,
      effect: h.entry.effect,
      advice: TABLE_ADVICE,
      quote: h.entry.quote,
      sources: h.entry.sources.map((s) => ({ title: s.title, url: s.url })),
      layer: "table",
    };
  });

  // Every pair of known medicines the table does not cover is said to be not checked.
  const uncovered: string[] = [];
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      if (lookupInteractions([joined(known[i]), joined(known[j])]).length === 0) uncovered.push(`${known[i].name} + ${known[j].name}`);
    }
  }
  for (const pair of uncovered.slice(0, MAX_PAIRS)) notChecked.push(`${pair} (not in the reviewed list yet)`);
  if (uncovered.length > MAX_PAIRS) notChecked.push(`${uncovered.length - MAX_PAIRS} more pairs (not in the reviewed list yet)`);

  // An answer with nothing in it must not read as "all clear": say what was not checked and why.
  if (rows.length === 0) notChecked.push("No medicines were found to check");
  else if (known.length === 1 && notChecked.length === 0) notChecked.push("Only one medicine is saved, so there is no pair to check");

  const sourcesChecked = new Map<string, SourceLink>();
  for (const i of interactions) for (const s of i.sources) sourcesChecked.set(s.url, s);

  const res: InteractionsRes = {
    checked_medicines: known.map((m) => m.name),
    interactions,
    sources_checked: [...sourcesChecked.values()],
    not_checked: notChecked,
    cached: false,
    ai: meta(),
  };

  // Saved per patient and medicine set (inserts are closed to users).
  const row = { patient_id: patientId, medicines_key: medicinesKey, result_json: res, created_at: new Date().toISOString() };
  const { error: saveError } = savedRow
    ? await admin.from("interaction_checks").update(row).eq("id", savedRow.id)
    : await admin.from("interaction_checks").insert(row);
  if (saveError) log({ event: "interaction_check_save_failed" });

  log({ event: "interactions", medicines: known.length, not_checked: notChecked.length, found: interactions.length });
  return res;
}
