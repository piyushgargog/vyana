import "server-only";
import { z } from "zod";
import type { AiMeta, Interaction, InteractionsReq, InteractionsRes, SourceLink } from "@vyana/shared";
import { runAi } from "./ai";
import { requireRole, type AuthedUser } from "./auth";
import { createHash } from "node:crypto";
import { TTL, cached } from "./cache";
import { log } from "./log";
import { INTERACTIONS_PROMPT_VERSION, INTERACTIONS_SYSTEM, interactionsPrompt, type Candidate } from "./prompts/interactions";
import { checkDiagnosisLanguage, findDosePatterns } from "./safety/blocklists";
import { saltsFor } from "./safety/brand-salts";
import { SALT_ALIASES, TABLE_ADVICE, lookupInteractions } from "./safety/interactions-table";
import { evidenceFound, hasNumber, numbersIn } from "./safety/verbatim";
import { supabaseAdmin } from "./supabase-admin";
import { fetchPages, search, type CallCounter } from "./tinyfish/client";
import { registerMockPage } from "./tinyfish/fixtures";
import { isOnDomain } from "./tinyfish/sources";

/**
 * Medicine interaction check (SPEC §14, PLAN §2A, ADR-033/046): brand → salt from the curated list, layer 1 = the
 * reviewed table in code, layer 2 = passages on trusted pages picked by code and confirmed by the model, each shown
 * with its exact quote. An empty result never means "safe".
 */

export const INTERACTION_DOMAINS = ["medlineplus.gov", "nih.gov", "ncbi.nlm.nih.gov", "drugs.com", "nhs.uk"];
const MAX_PAIRS = 15;
const PAGES_PER_PAIR = 2;
const PAGE_CHARS = 8_000;
const MAX_CANDIDATES_PER_PAIR = 4;
const MAX_EFFECT_CHARS = 200;
const RESULT_DAYS = 7;

interface Medicine {
  name: string;
  salts: string[];
}

interface Page {
  title: string;
  url: string;
  text: string;
}

/** What is cached per salt pair (public data, no patient details). */
interface PairResult {
  sources: SourceLink[];
  findings: { quote: string; effect: string; source: SourceLink }[];
}

// ---------------------------------------------------------------- pure helpers

/** Severity from the source's own words (§2A: never the model's judgement). */
export function severityOf(quote: string): Interaction["severity"] {
  const q = quote.toLowerCase();
  if (/\b(?:avoid|do not|don't|should not|must not|contraindicated|serious|life-threatening|dangerous|fatal)\b/.test(q)) return "major";
  if (/\b(?:may|might|can|could|increase[sd]?|decrease[sd]?|reduce[sd]?|risk|interact[s]?|affect[s]?)\b/.test(q)) return "moderate";
  return "minor";
}

/** The model's one-line effect is shown only if it adds nothing the quote doesn't say (numbers, doses, diagnoses, "safe"). */
export function effectOk(effect: string, quote: string): boolean {
  const e = effect.trim();
  return (
    e.length > 0 &&
    e.length <= MAX_EFFECT_CHARS &&
    numbersIn(e).every((n) => hasNumber(quote, n)) &&
    findDosePatterns(e).length === 0 &&
    checkDiagnosisLanguage(e).phrases.length === 0 &&
    !/\bsafe(?:ly|ty)?\b/i.test(e)
  );
}

/** A salt and its other names, for finding it in page text. */
function namesOf(salt: string): string[] {
  return [salt, ...Object.entries(SALT_ALIASES).filter(([, main]) => main === salt).map(([alias]) => alias)];
}

function mentions(text: string, names: string[]): boolean {
  const t = text.toLowerCase();
  return names.some((n) => {
    const i = t.indexOf(n);
    if (i === -1) return false;
    const before = i === 0 ? " " : t[i - 1];
    const after = t[i + n.length] ?? " ";
    return !/[a-z]/.test(before) && !/[a-z]/.test(after);
  });
}

/** Lines and sentences of a page, 20–400 characters. */
function passages(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.replace(/^[\s*#>-]+/, "").trim())
    .filter((s) => s.length >= 20 && s.length <= 400);
}

/** Passages that name one salt, on a page or in a passage about the other (code picks; the model only confirms). */
export function candidatesFor(a: string, b: string, pages: Page[]): { text: string; page: Page }[] {
  const an = namesOf(a);
  const bn = namesOf(b);
  const both: { text: string; page: Page }[] = [];
  const one: { text: string; page: Page }[] = [];
  for (const page of pages) {
    const titleA = mentions(page.title, an);
    const titleB = mentions(page.title, bn);
    for (const text of passages(page.text)) {
      const hasA = mentions(text, an);
      const hasB = mentions(text, bn);
      if (hasA && hasB) both.push({ text, page });
      else if ((hasB && titleA) || (hasA && titleB)) one.push({ text, page });
    }
  }
  const seen = new Set<string>();
  return [...both, ...one].filter((c) => !seen.has(c.text) && seen.add(c.text)).slice(0, MAX_CANDIDATES_PER_PAIR);
}

// ---------------------------------------------------------------- pages

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

async function pairPages(a: string, b: string, counter: CallCounter): Promise<Page[]> {
  const res = await search({ query: `${a} ${b} interaction`, include_domains: INTERACTION_DOMAINS }, { counter });
  const urls = res.results
    .map((r) => r.url)
    .filter((u) => INTERACTION_DOMAINS.some((d) => isOnDomain(u, d)))
    .slice(0, PAGES_PER_PAIR);
  if (!urls.length) return [];
  if (process.env.TINYFISH_MOCK === "1") {
    for (const u of urls) registerMockPage(u, `# [mock] ${a}\n\nTaking ${a} with ${b} may increase the risk of side effects.\n\nKeep a list of all your medicines.`);
  }
  const fetched = await fetchPages({ urls, format: "markdown" }, { counter });
  return fetched.results
    .filter((r) => r.text && INTERACTION_DOMAINS.some((d) => isOnDomain(r.final_url ?? r.url, d)))
    .map((r) => ({ title: r.title ?? r.url, url: r.final_url ?? r.url, text: (r.text as string).slice(0, PAGE_CHARS) }));
}

// ---------------------------------------------------------------- route logic

const Confirmations = z.object({
  results: z.array(z.object({ id: z.number().int(), states_interaction: z.boolean(), effect: z.string() })),
});

const display = (r: { medicine_name: string; strength: string | null }) => (r.strength ? `${r.medicine_name} ${r.strength}` : r.medicine_name);
const meta = (model: string): AiMeta => ({ model, prompt_version: INTERACTIONS_PROMPT_VERSION, generated_at: new Date().toISOString() });

export async function checkInteractions({ sb, user, profile }: AuthedUser, body: InteractionsReq, counter: CallCounter): Promise<InteractionsRes> {
  requireRole(profile, "patient");

  // The caller's medicines, read through RLS.
  const query = sb.from("prescription_items").select("medicine_name, strength").eq("patient_id", user.id);
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
    .eq("patient_id", user.id)
    .eq("medicines_key", medicinesKey)
    .maybeSingle();
  const savedRow = saved as { id: string; result_json: InteractionsRes; created_at: string } | null;
  if (savedRow && Date.now() - new Date(savedRow.created_at).getTime() < RESULT_DAYS * 24 * 60 * 60 * 1000) {
    return { ...savedRow.result_json, not_checked: notChecked, cached: true };
  }

  // Layer 1: the reviewed table, in code.
  const tableHits = lookupInteractions(known.map((m) => m.salts.join(" + ")));
  const interactions: Interaction[] = tableHits.map((h) => {
    const [ia, ib] = h.medicines.map((s) => known.find((m) => m.salts.join(" + ") === s) as Medicine);
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
  const covered = new Set(tableHits.map((h) => pairKey(h.entry.salts[0], h.entry.salts[1])));

  // Layer 2: salt pairs the table doesn't cover, at most 15.
  const pairs: { a: string; b: string; ma: Medicine; mb: Medicine }[] = [];
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      for (const a of known[i].salts) {
        for (const b of known[j].salts) {
          if (a === b || covered.has(pairKey(a, b)) || pairs.some((p) => pairKey(p.a, p.b) === pairKey(a, b))) continue;
          pairs.push({ a, b, ma: known[i], mb: known[j] });
        }
      }
    }
  }
  const checkedPairs = pairs.slice(0, MAX_PAIRS);
  for (const p of pairs.slice(MAX_PAIRS)) notChecked.push(`${p.ma.name} + ${p.mb.name} (too many medicines to check at once)`);

  const results = new Map<string, PairResult>();
  const toConfirm: { pair: (typeof pairs)[number]; pages: Page[]; candidates: { text: string; page: Page }[] }[] = [];
  await Promise.all(
    checkedPairs.map(async (pair) => {
      const key = `interaction_pair:${pairKey(pair.a, pair.b)}`;
      try {
        const hit = await cached<PairResult>(key, "interaction_pair", TTL.day, async () => null);
        if (hit) {
          results.set(pairKey(pair.a, pair.b), hit.value);
          return;
        }
        const pages = await pairPages(pair.a, pair.b, counter);
        toConfirm.push({ pair, pages, candidates: candidatesFor(pair.a, pair.b, pages) });
      } catch {
        log({ event: "interaction_pair_failed" });
        notChecked.push(`${pair.ma.name} + ${pair.mb.name} (couldn't be checked right now)`);
      }
    }),
  );

  // One model call for every new passage: does it state an interaction?
  const candidates: (Candidate & { page: Page; pairIndex: number })[] = [];
  toConfirm.forEach((t, pairIndex) => {
    for (const c of t.candidates) candidates.push({ id: candidates.length + 1, a: t.pair.a, b: t.pair.b, pageTitle: c.page.title, text: c.text, page: c.page, pairIndex });
  });
  let ai = meta(results.size ? "cache" : "none");
  const confirmed = new Map<number, string>();
  if (candidates.length) {
    const run = await runAi({
      feature: "interactions",
      kind: "text",
      schema: Confirmations,
      system: INTERACTIONS_SYSTEM,
      prompt: interactionsPrompt(candidates),
      promptVersion: INTERACTIONS_PROMPT_VERSION,
      sources: toConfirm.flatMap((t) => t.pages.map((p) => ({ title: p.title, url: p.url }))),
      userId: user.id,
      mock: { results: candidates.map((c) => ({ id: c.id, states_interaction: true, effect: "[mock] Taking these together may change how they work." })) },
      statusOf: (o) => (o.results.every((r) => !r.states_interaction || effectOk(r.effect, candidates.find((c) => c.id === r.id)?.text ?? "")) ? "ok" : "needs_review"),
    });
    ai = run.ai;
    for (const r of run.object.results) {
      const c = candidates.find((x) => x.id === r.id);
      if (c && r.states_interaction && evidenceFound(c.page.text, c.text) && effectOk(r.effect, c.text)) confirmed.set(c.id, r.effect.trim());
    }
  }
  await Promise.all(
    toConfirm.map((t, pairIndex) => {
      const findings = candidates
        .filter((c) => c.pairIndex === pairIndex && confirmed.has(c.id))
        .map((c) => ({ quote: c.text, effect: confirmed.get(c.id) as string, source: { title: c.page.title, url: c.page.url } }));
      const value: PairResult = { sources: t.pages.map((p) => ({ title: p.title, url: p.url })), findings };
      results.set(pairKey(t.pair.a, t.pair.b), value);
      return cached<PairResult>(`interaction_pair:${pairKey(t.pair.a, t.pair.b)}`, "interaction_pair", TTL.day, async () => value);
    }),
  );

  for (const pair of checkedPairs) {
    const r = results.get(pairKey(pair.a, pair.b));
    for (const f of r?.findings ?? []) {
      interactions.push({
        medicine_a: pair.ma.name,
        medicine_b: pair.mb.name,
        severity: severityOf(f.quote),
        effect: f.effect,
        advice: TABLE_ADVICE,
        quote: f.quote,
        sources: [f.source],
        layer: "sources",
      });
    }
  }

  const sourcesChecked = new Map<string, SourceLink>();
  for (const i of interactions.filter((x) => x.layer === "table")) for (const s of i.sources) sourcesChecked.set(s.url, s);
  for (const r of results.values()) for (const s of r.sources) sourcesChecked.set(s.url, s);

  const res: InteractionsRes = {
    checked_medicines: known.map((m) => m.name),
    interactions,
    sources_checked: [...sourcesChecked.values()],
    not_checked: notChecked,
    cached: false,
    ai,
  };

  // Saved per patient and medicine set (inserts are closed to users).
  const row = { patient_id: user.id, medicines_key: medicinesKey, result_json: res, created_at: new Date().toISOString() };
  const { error: saveError } = savedRow
    ? await admin.from("interaction_checks").update(row).eq("id", savedRow.id)
    : await admin.from("interaction_checks").insert(row);
  if (saveError) log({ event: "interaction_check_save_failed" });

  log({ event: "interactions", medicines: known.length, not_checked: notChecked.length, pairs: checkedPairs.length, found: interactions.length });
  return res;
}
