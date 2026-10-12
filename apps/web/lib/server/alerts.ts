import "server-only";
import type { AlertsCheckRes, DrugAlert } from "@vyana/shared";
import { requireRole, type AuthedUser } from "./auth";
import { log } from "./log";
import { saltsFor } from "./safety/brand-salts";
import { supabaseAdmin } from "./supabase-admin";
import { fetchPages, search, type CallCounter } from "./tinyfish/client";
import { isGovUrl } from "./tinyfish/sources";

/**
 * Medicine quality alerts (SPEC §9, §10, ADR-049): a code rule, no model. A result counts only when it is on a
 * government page, names the medicine (brand or salt, whole words) and uses alert wording.
 */

const MAX_MEDICINES = 10;
const ONE_YEAR_MINUTES = 525_600;

const ALERT_WORDS = /\b(?:not of standard quality|nsq|recall(?:ed|s)?|spurious|adulterated|misbranded|sub-?standard|banned)\b/i;

export interface MedicineNames {
  /** As the patient sees it, e.g. "Dolo 650 mg". */
  label: string;
  /** Lowercase names to look for: the brand (first words of the line) and its salts. */
  names: string[];
}

const STRENGTH = /\b\d[\d.]*\s*(?:mg|mcg|g|ml|iu|%)?\b/gi;

/** The brand (without strength) and the salts of a prescription line. */
export function namesFor(medicine: string, strength: string | null): MedicineNames {
  const brand = medicine.replace(/\([^)]*\)/g, " ").replace(STRENGTH, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const salts = saltsFor(medicine)?.salts ?? [];
  const names = [...new Set([brand, ...salts].filter((n) => n.length >= 3))];
  return { label: strength ? `${medicine} ${strength}` : medicine, names };
}

function hasWord(text: string, word: string): boolean {
  const t = text.toLowerCase();
  for (let i = t.indexOf(word); i !== -1; i = t.indexOf(word, i + 1)) {
    const before = i === 0 ? " " : t[i - 1];
    const after = t[i + word.length] ?? " ";
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
  }
  return false;
}

/** ADR-049: names the medicine (brand or salt) and reports a quality problem. */
export function alertMatch(text: string, names: string[]): boolean {
  return ALERT_WORDS.test(text) && names.some((n) => hasWord(text, n));
}

interface Found {
  medicine: string;
  title: string;
  url: string;
  snippet: string | null;
}

/** Inserts alerts the patient doesn't have yet (unique patient + url); inserts are closed to users. */
async function saveAlerts(patientId: string, found: Found[]): Promise<number> {
  const admin = supabaseAdmin();
  const { data } = await admin.from("drug_alerts").select("url").eq("patient_id", patientId);
  const have = new Set(((data ?? []) as { url: string }[]).map((r) => r.url));
  const rows = found
    .filter((f, i) => !have.has(f.url) && found.findIndex((g) => g.url === f.url) === i)
    .map((f) => ({ patient_id: patientId, medicine_name: f.medicine, title: f.title, url: f.url, snippet: f.snippet, created_at: new Date().toISOString() }));
  if (!rows.length) return 0;
  const { error } = await admin.from("drug_alerts").insert(rows);
  if (error) log({ event: "drug_alerts_insert_failed" });
  return error ? 0 : rows.length;
}

// ---------------------------------------------------------------- §9: on demand

export async function checkAlerts({ sb, user, profile }: AuthedUser, counter: CallCounter): Promise<AlertsCheckRes> {
  requireRole(profile, "patient");
  const { data, error } = await sb.from("prescription_items").select("medicine_name, strength").eq("patient_id", user.id).eq("active", true);
  if (error) throw error;
  const seen = new Set<string>();
  const medicines = ((data ?? []) as { medicine_name: string; strength: string | null }[])
    .map((r) => namesFor(r.medicine_name, r.strength))
    .filter((m) => !seen.has(m.label) && seen.add(m.label))
    .slice(0, MAX_MEDICINES);

  const found: Found[] = [];
  await Promise.all(
    medicines.map(async (m) => {
      try {
        const res = await search(
          { query: `${m.names[0] ?? m.label} not of standard quality OR recall CDSCO`, include_domains: ["cdsco.gov.in"], recency_minutes: ONE_YEAR_MINUTES },
          { counter },
        );
        for (const r of res.results) {
          if (isGovUrl(r.url) && alertMatch(`${r.title} ${r.snippet}`, m.names)) {
            found.push({ medicine: m.label, title: r.title || r.url, url: r.url, snippet: r.snippet || null });
          }
        }
      } catch {
        log({ event: "alerts_search_failed" });
      }
    }),
  );
  const added = await saveAlerts(user.id, found);

  const { data: rows } = await sb
    .from("drug_alerts")
    .select("id, medicine_name, title, url, snippet, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });
  log({ event: "alerts_check", medicines: medicines.length, found: found.length, added });
  return { checked_medicines: medicines.map((m) => m.label), alerts: (rows ?? []) as DrugAlert[] };
}

// ---------------------------------------------------------------- §10: Monitor webhook

export interface MonitorResult {
  title?: string;
  url: string;
  snippet?: string;
}

/** New Monitor results → alerts for every patient whose active medicine they name (runs in `after()`). */
export async function processMonitorResults(results: MonitorResult[], counter: CallCounter): Promise<number> {
  const gov = results.filter((r) => isGovUrl(r.url)).slice(0, 10);
  if (!gov.length) return 0;

  const texts = new Map<string, string>();
  try {
    const fetched = await fetchPages({ urls: gov.map((r) => r.url), purpose: "Read medicine quality alerts" }, { counter });
    for (const p of fetched.results) texts.set(p.url, p.text ?? "");
  } catch {
    log({ event: "monitor_fetch_failed" });
  }

  const { data } = await supabaseAdmin().from("prescription_items").select("patient_id, medicine_name, strength").eq("active", true);
  const items = (data ?? []) as { patient_id: string; medicine_name: string; strength: string | null }[];

  const byPatient = new Map<string, Found[]>();
  for (const r of gov) {
    const text = `${r.title ?? ""} ${r.snippet ?? ""} ${texts.get(r.url) ?? ""}`;
    if (!ALERT_WORDS.test(text)) continue;
    for (const it of items) {
      const m = namesFor(it.medicine_name, it.strength);
      if (!alertMatch(text, m.names)) continue;
      const list = byPatient.get(it.patient_id) ?? [];
      list.push({ medicine: m.label, title: r.title || r.url, url: r.url, snippet: r.snippet ?? null });
      byPatient.set(it.patient_id, list);
    }
  }
  let added = 0;
  for (const [patientId, found] of byPatient) added += await saveAlerts(patientId, found);
  // Push notifications for these alerts come with V6 (push.ts); the app also reads drug_alerts directly.
  log({ event: "monitor_alerts", results: gov.length, patients: byPatient.size, added });
  return added;
}
