import "server-only";
import { z } from "zod";
import { Language, type AiMeta, type TriageReq, type TriageRes } from "@vyana/shared";
import { runAi } from "./ai";
import type { AuthedUser } from "./auth";
import { log } from "./log";
import { TRIAGE_PROMPT_VERSION, TRIAGE_SYSTEM, triagePrompt } from "./prompts/triage";
import { matchRedFlags, redFlagLabels } from "./safety/red-flags";
import { redact } from "./safety/redact";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Symptom triage (SPEC §15, PLAN §2A, ADR-045): fixed red-flag rules first, then the model only picks urgency and
 * departments from our list. Every sentence the user reads is fixed text from here.
 */

const DEFAULT_DEPARTMENT = "General Medicine";
const MAX_DEPARTMENTS = 2;

/** The general warning signs shown with every non-emergency result (ids in `red-flags.ts`). */
export const TRIAGE_WATCH_FOR = ["chest_pain", "breathing", "unconscious", "bleeding", "stroke_signs", "seizure", "severe_pain"];

export const TriageLlm = z.object({
  urgency: z.enum(["soon", "routine"]),
  departments: z.array(z.string()),
});
export type TriageLlm = z.infer<typeof TriageLlm>;

const or: Record<Language, string> = { en: " or ", hi: " या ", hinglish: " ya " };

export const ADVICE: Record<Language, Record<TriageRes["urgency"], (departments: string) => string>> = {
  en: {
    emergency: () => "Call 108 now or press SOS.",
    soon: (d) => `Please see a ${d} doctor within the next day or two. If any warning sign below appears, call 108 or press SOS.`,
    routine: (d) => `Book an appointment with a ${d} doctor in the next few days. If your symptoms get worse or a warning sign below appears, see a doctor sooner.`,
  },
  hi: {
    emergency: () => "अभी 108 पर कॉल करें या SOS बटन दबाएँ।",
    soon: (d) => `कृपया अगले एक-दो दिन में ${d} के डॉक्टर को दिखाएँ। नीचे दिया कोई भी खतरे का संकेत दिखे तो 108 पर कॉल करें या SOS दबाएँ।`,
    routine: (d) => `अगले कुछ दिनों में ${d} के डॉक्टर से अपॉइंटमेंट लें। लक्षण बढ़ें या नीचे दिया कोई खतरे का संकेत दिखे तो जल्दी डॉक्टर को दिखाएँ।`,
  },
  hinglish: {
    emergency: () => "Abhi 108 par call karein ya SOS button dabayein.",
    soon: (d) => `Please agle ek-do din mein ${d} ke doctor ko dikhayein. Neeche diya koi bhi warning sign dikhe to 108 par call karein ya SOS dabayein.`,
    routine: (d) => `Agle kuch dinon mein ${d} ke doctor ka appointment lein. Symptoms badhein ya neeche diya koi warning sign dikhe to jaldi doctor ko dikhayein.`,
  },
};

export const DISCLAIMER: Record<Language, string> = {
  en: "This is not a diagnosis. Vyana only suggests where to go; a doctor decides what is wrong.",
  hi: "यह निदान नहीं है। Vyana सिर्फ़ बताता है कि कहाँ दिखाना है; क्या समस्या है, यह डॉक्टर तय करते हैं।",
  hinglish: "Yeh diagnosis nahi hai. Vyana sirf batata hai ki kahan dikhana hai; kya problem hai, yeh doctor decide karte hain.",
};

const squash = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

/** Keeps names from the allowed list (ignoring case and spaces), in the model's order, at most 2. */
export function matchDepartments(names: string[], allowed: string[]): string[] {
  const byKey = new Map(allowed.map((a) => [squash(a), a]));
  const out: string[] = [];
  for (const n of names) {
    const hit = byKey.get(squash(n));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out.slice(0, MAX_DEPARTMENTS);
}

/** Distinct department names from the seeded hospitals (public data). */
async function allowedDepartments(): Promise<string[]> {
  const { data, error } = await supabaseAdmin().from("departments").select("name");
  if (error) log({ event: "triage_departments_failed" });
  const names = [...new Set(((data ?? []) as { name: string }[]).map((d) => d.name.trim()).filter(Boolean))].sort();
  return names.includes(DEFAULT_DEPARTMENT) ? names : [...names, DEFAULT_DEPARTMENT];
}

const meta = (model: string, promptVersion: string): AiMeta => ({ model, prompt_version: promptVersion, generated_at: new Date().toISOString() });

export async function triage({ user, profile }: AuthedUser, body: TriageReq): Promise<TriageRes> {
  const language = body.language ?? Language.catch("en").parse(profile.preferred_language);

  // 1. Fixed rules first: no model is involved in an emergency (§2A rule 4).
  const flags = matchRedFlags(`${body.symptoms} ${body.duration ?? ""}`);
  if (flags.length) {
    return {
      urgency: "emergency",
      departments: ["Emergency"],
      advice: ADVICE[language].emergency(""),
      red_flags: redFlagLabels(flags),
      disclaimer: DISCLAIMER[language],
      ai: meta("rules", "red-flags"),
    };
  }

  // 2. The model only classifies, from redacted text and our department list.
  const allowed = await allowedDepartments();
  const knownNames = profile.full_name ? [profile.full_name] : [];
  const symptoms = redact(body.symptoms, { knownNames }).text;
  const duration = body.duration ? redact(body.duration, { knownNames }).text : undefined;

  let urgency: "soon" | "routine" = "soon";
  let departments: string[] = [];
  let ai: AiMeta;
  try {
    const result = await runAi({
      feature: "triage",
      kind: "text",
      schema: TriageLlm,
      system: TRIAGE_SYSTEM,
      prompt: triagePrompt({ symptoms, duration, age: body.age, sex: body.sex }, allowed),
      promptVersion: TRIAGE_PROMPT_VERSION,
      sources: [],
      userId: user.id,
      // "Astrology" is not a department: the mock shows the list check dropping it.
      mock: { urgency: "routine" as const, departments: ["Dermatology", "Astrology"] },
      statusOf: (o) => (matchDepartments(o.departments, allowed).length === o.departments.length ? "ok" : "needs_review"),
    });
    urgency = result.object.urgency;
    departments = matchDepartments(result.object.departments, allowed);
    ai = result.ai;
  } catch (err) {
    // Unsure → see a doctor soon (§2A rule 6).
    log({ event: "triage_fallback", error: err instanceof Error ? err.name : "Error" });
    ai = meta("fallback", TRIAGE_PROMPT_VERSION);
  }
  if (!departments.length) departments = [DEFAULT_DEPARTMENT];

  return {
    urgency,
    departments,
    advice: ADVICE[language][urgency](departments.join(or[language])),
    red_flags: redFlagLabels(TRIAGE_WATCH_FOR),
    disclaimer: DISCLAIMER[language],
    ai,
  };
}
