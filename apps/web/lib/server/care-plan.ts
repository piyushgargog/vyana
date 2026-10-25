import "server-only";
import { z } from "zod";
import { Language, MEAL_TYPES, type CarePlan, type GenerateCarePlanReq, type GenerateCarePlanRes, type SourceLink } from "@vyana/shared";
import { runAi } from "./ai";
import type { AuthedUser } from "./auth";
import { forbidden, notFound, upstream } from "./errors";
import { log } from "./log";
import { CARE_PLAN_PROMPT_VERSION, CARE_PLAN_SYSTEM, carePlanPrompt } from "./prompts/care-plan";
import { checkDiagnosisLanguage, findDosePatterns } from "./safety/blocklists";
import { redFlagsForCondition } from "./safety/condition-red-flags";
import { RED_FLAG_RULES } from "./safety/red-flags";
import { evidenceFound, hasNumber, normalizeText, numbersIn } from "./safety/verbatim";
import { supabaseAdmin } from "./supabase-admin";
import { guidelinePages, type Page } from "./web/guideline-pages";

/**
 * Care plans (SPEC §13, PLAN §2A, ADR-044): built only from fetched guideline pages, every bullet quoting its page,
 * checked in code; red flags merged with the curated per-condition list; saved as a draft for the doctor or as a
 * patient-generated plan.
 */

const Bullet = z.object({ text: z.string(), quote: z.string(), source: z.number().int() });
type Bullet = z.infer<typeof Bullet>;
const Meal = z.enum(MEAL_TYPES);

/** What the model returns: the contract's `CarePlan`, but every bullet with its quote and page number. */
export const CarePlanLlm = z.object({
  summary: Bullet.nullable(),
  do: z.array(Bullet),
  dont: z.array(Bullet),
  diet: z.object({
    eat_more: z.array(Bullet),
    limit: z.array(Bullet),
    sample_day: z.array(z.object({ meal: Meal, items: z.array(z.string()) })),
  }),
  red_flags: z.array(Bullet),
  follow_up_tests: z.array(z.object({ test: z.string(), quote: z.string(), source: z.number().int() })),
});
export type CarePlanLlm = z.infer<typeof CarePlanLlm>;

const SUMMARY_FALLBACK: Record<Language, (condition: string) => string> = {
  en: (c) => `Care plan for ${c}, from trusted health sources.`,
  hi: (c) => `${c} के लिए देखभाल योजना, भरोसेमंद स्वास्थ्य स्रोतों से।`,
  hinglish: (c) => `${c} ke liye care plan, trusted health sources se.`,
};

// ---------------------------------------------------------------- follow-up intervals (computed, never the model's)

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };
const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, six: 6, twelve: 12 };
const toNumber = (s: string) => WORD_NUMBERS[s] ?? Number(s);

/** How often, in days, a quote says to repeat something ("every 3 to 6 months" → 90, the shorter one). */
export function intervalDays(quote: string): number | null {
  const q = normalizeText(quote);
  const numbered = q.match(/\bevery (\d{1,3}|one|two|three|four|six|twelve)(?: (?:to|or|-) \d{1,3})? (day|week|month|year)s?\b/);
  if (numbered) return toNumber(numbered[1]) * UNIT_DAYS[numbered[2]];
  const single = q.match(/\b(?:every|each|once a|once every|once per) (day|week|month|year)\b/);
  if (single) return UNIT_DAYS[single[1]];
  if (/\btwice a year\b/.test(q)) return 182;
  if (/\b(?:annual|annually|yearly)\b/.test(q)) return 365;
  if (/\bmonthly\b/.test(q)) return 30;
  if (/\bweekly\b/.test(q)) return 7;
  return null;
}

// ---------------------------------------------------------------- checks

export interface VerifiedPlan {
  plan: CarePlan;
  dropped: number;
  /** At least one do / don't / diet bullet survived. */
  hasContent: boolean;
}

/** Checks every bullet against its page (ADR-044) and builds the contract's `CarePlan`. */
export function verifyCarePlan(out: CarePlanLlm, pages: Page[], condition: string, language: Language): VerifiedPlan {
  let dropped = 0;
  const cited = new Set<number>();

  const keep = (b: Bullet, opts: { diet?: boolean } = {}): boolean => {
    const page = pages[b.source - 1];
    const text = b.text.trim();
    const ok =
      text.length > 0 &&
      page !== undefined &&
      evidenceFound(page.text, b.quote) &&
      numbersIn(text).every((n) => hasNumber(b.quote, n)) &&
      findDosePatterns(text, { allowMeasures: opts.diet }).length === 0 &&
      checkDiagnosisLanguage(text, [condition]).phrases.length === 0;
    if (ok) cited.add(b.source);
    else dropped++;
    return ok;
  };
  const texts = (bullets: Bullet[], opts?: { diet?: boolean }) => bullets.filter((b) => keep(b, opts)).map((b) => b.text.trim());

  const summary = out.summary && keep(out.summary) ? out.summary.text.trim() : SUMMARY_FALLBACK[language](condition);
  const doList = texts(out.do);
  const dontList = texts(out.dont);
  const eatMoreBullets = out.diet.eat_more.filter((b) => keep(b, { diet: true }));
  const limit = texts(out.diet.limit, { diet: true });

  // Sample day: only foods named in the verified "eat more" bullets or their quotes.
  const foods = normalizeText(eatMoreBullets.map((b) => `${b.text} ${b.quote}`).join(" "));
  const sampleDay = out.diet.sample_day
    .map((m) => {
      const items = m.items.map((i) => i.trim()).filter((i) => {
        const ok = normalizeText(i).length > 1 && foods.includes(normalizeText(i));
        if (!ok) dropped++;
        return ok;
      });
      return { meal: m.meal, items };
    })
    .filter((m) => m.items.length > 0);

  const followUps = out.follow_up_tests.flatMap((t) => {
    const page = pages[t.source - 1];
    const every = page && evidenceFound(page.text, t.quote) ? intervalDays(t.quote) : null;
    if (!every || !t.test.trim()) {
      dropped++;
      return [];
    }
    cited.add(t.source);
    return [{ test: t.test.trim(), every_days: every }];
  });

  // Red flags: quoted ones + the curated list; general emergency signs only when neither gives any.
  const curated = redFlagsForCondition(condition);
  const redFlags = [...texts(out.red_flags), ...curated.flatMap((c) => c.items.map((i) => i.text))];
  if (redFlags.length === 0) redFlags.push(...RED_FLAG_RULES.map((r) => r.label));
  const uniqueFlags = [...new Map(redFlags.map((f) => [normalizeText(f), f])).values()];

  const sources: SourceLink[] = [...cited].sort((a, b) => a - b).map((i) => ({ title: pages[i - 1].title, url: pages[i - 1].url }));
  for (const c of curated) {
    for (const i of c.items) if (!sources.some((s) => s.url === i.source.url)) sources.push({ title: i.source.title, url: i.source.url });
  }

  return {
    plan: {
      condition,
      summary,
      do: doList,
      dont: dontList,
      diet: { eat_more: eatMoreBullets.map((b) => b.text.trim()), limit, sample_day: sampleDay },
      red_flags: uniqueFlags,
      follow_up_tests: followUps,
      sources,
      language,
    },
    dropped,
    hasContent: doList.length + dontList.length + eatMoreBullets.length + limit.length > 0,
  };
}

const b = (text: string, quote: string, source = 1): Bullet => ({ text, quote, source });
/** `LLM_MOCK=1`: quotes the mock page; one bullet and one food are invented on purpose, so the checks drop them. */
const MOCK_PLAN: CarePlanLlm = {
  summary: b("[mock] Healthy daily habits help you stay healthy.", "helps you stay healthy"),
  do: [b("Walk briskly for 30 minutes a day.", "brisk walking for 30 minutes a day"), b("Drink 3 litres of water a day.", "Drink plenty of water")],
  dont: [b("Don't smoke, and limit alcohol.", "Stop smoking and limit alcohol")],
  diet: {
    eat_more: [b("Vegetables, oats, brown rice and dal", "Eat plenty of vegetables, whole grains such as oats and brown rice, and pulses such as dal")],
    limit: [b("Sweets and fried snacks", "Limit foods high in sugar and salt, such as sweets and fried snacks")],
    sample_day: [
      { meal: "breakfast", items: ["oats", "milk"] },
      { meal: "lunch", items: ["brown rice", "dal", "vegetables"] },
    ],
  },
  red_flags: [b("Feeling very unwell", "Get urgent medical help if you feel very unwell")],
  follow_up_tests: [{ test: "HbA1c", quote: "Have your blood sugar (HbA1c) checked every 3 months", source: 1 }],
};

// ---------------------------------------------------------------- route logic

/**
 * Groq's free tier gives a model 8,000 tokens a minute, prompt and answer together: with three pages of 12,000
 * characters the prompt alone is about 9,000 tokens, and Groq cut every answer short ("max completion tokens reached
 * before generating a valid document", 21 Oct). So the model sees the start of each page: the first page (the topic that matches
 * the condition best) in full, since a MedlinePlus summary only reaches "treatments" after about 4,500 characters, and the
 * other pages in part. The quotes of the plan are checked against this same text, so a quote must still be on what the model was given.
 */
export const PROMPT_FIRST_PAGE_CHARS = 5_500;
export const PROMPT_OTHER_PAGE_CHARS = 2_500;
export const forPrompt = (pages: Page[]): Page[] =>
  pages.map((p, i) => ({ ...p, text: p.text.slice(0, i === 0 ? PROMPT_FIRST_PAGE_CHARS : PROMPT_OTHER_PAGE_CHARS) }));

export async function generateCarePlan(authed: AuthedUser, body: GenerateCarePlanReq): Promise<GenerateCarePlanRes> {
  const { sb, user, profile } = authed;

  // Read as the caller: RLS shows a patient their own conditions and a doctor their patients' conditions.
  const { data, error } = await sb.from("conditions").select("id, patient_id, name, source").eq("id", body.condition_id).maybeSingle();
  if (error) throw error;
  const condition = data as { id: string; patient_id: string; name: string; source: string } | null;
  if (!condition) throw notFound("This condition was not found.");
  const asPatient = profile.role === "patient";
  if (asPatient && condition.patient_id !== user.id) throw notFound("This condition was not found.");
  if (asPatient && condition.source !== "patient") throw forbidden("Your doctor prepares the care plan for this condition.");

  const admin = supabaseAdmin();
  const { data: patient } = await admin.from("profiles").select("preferred_language").eq("id", condition.patient_id).maybeSingle();
  const language = body.language ?? Language.catch("en").parse((patient as { preferred_language?: unknown } | null)?.preferred_language);

  let pages: Page[];
  try {
    pages = await guidelinePages(condition.name);
  } catch {
    log({ event: "care_plan_pages_failed" });
    pages = [];
  }
  if (!pages.length) throw upstream("Couldn't find trusted guidance for this condition right now. Please try again later.");
  pages = forPrompt(pages);

  const { object, ai } = await runAi({
    feature: "care_plan",
    data: "public", // the condition name and public guideline pages only (ADR-056)
    kind: "text",
    schema: CarePlanLlm,
    system: CARE_PLAN_SYSTEM,
    prompt: carePlanPrompt(condition.name, language, pages),
    promptVersion: CARE_PLAN_PROMPT_VERSION,
    sources: pages.map((p) => ({ title: p.title, url: p.url })),
    userId: user.id,
    inputRef: `conditions/${condition.id}`,
    mock: MOCK_PLAN,
    statusOf: (o) => (verifyCarePlan(o, pages, condition.name, language).dropped > 0 ? "needs_review" : "ok"),
  });

  const verified = verifyCarePlan(object, pages, condition.name, language);
  if (!verified.hasContent) throw upstream("Couldn't build a care plan from trusted sources. Please ask your doctor.");

  const status = asPatient ? "patient_generated" : "draft";
  const { data: saved, error: saveError } = await admin
    .from("care_plans")
    .insert({ patient_id: condition.patient_id, condition_id: condition.id, status, language, plan_json: verified.plan })
    .select("id")
    .single();
  if (saveError || !saved) throw saveError ?? new Error("care plan not saved");

  log({ event: "care_plan", status, dropped: verified.dropped, pages: pages.length });
  return { care_plan_id: (saved as { id: string }).id, status, plan: verified.plan, ai };
}
