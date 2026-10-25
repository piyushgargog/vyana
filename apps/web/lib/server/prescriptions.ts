import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEFAULT_TIMES, PrescriptionItem, addDays, isoDate, istDayOf, type PrescriptionExtractRes } from "@vyana/shared";
import { runAi } from "./ai";
import { checkUploadPath, downloadUpload, readDocumentText } from "./documents";
import { RX_EXTRACT_PROMPT_VERSION, RX_EXTRACT_SYSTEM, rxExtractPrompt } from "./prompts/documents";
import { redact, restore } from "./safety/redact";
import { evidenceFound, field, hasNumber } from "./safety/verbatim";

/**
 * Prescription scan (SPEC §3, §2A, ADR-041): document text → redaction → extraction where every field quotes the
 * text → checks in code → saved for the patient to review before any reminder is set.
 */

// The form / frequency / with-food lists live in the PrescriptionItem contract; the model is held to the same lists.
const FORMS = PrescriptionItem.shape.form.options;
const FREQUENCIES = PrescriptionItem.shape.frequency.options;
const FOOD = PrescriptionItem.shape.with_food.options;

export const RxLlm = z.object({
  doctor_name: field(z.string()),
  diagnosis: field(z.string()),
  issued_on: field(z.string()),
  items: z.array(
    z.object({
      medicine_name: field(z.string()),
      strength: field(z.string()),
      form: field(z.enum(FORMS)),
      dose: field(z.string()),
      frequency: field(z.enum(FREQUENCIES)),
      times: field(z.array(z.string())),
      with_food: field(z.enum(FOOD)),
      duration_days: field(z.number().int().positive()),
      quantity_total: field(z.number().positive()),
      instructions: field(z.string()),
    }),
  ),
});
export type RxLlm = z.infer<typeof RxLlm>;
type Field<T> = { value: T | null; evidence: string | null };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

type Frequency = PrescriptionItem["frequency"];

/**
 * How often a medicine is taken, read from the words the prescription uses (ADR-058, PLAN §2A rule 4): the model only
 * quotes them, the code says what they mean. `1-0-1` is twice a day. Returns null when the words don't say.
 */
export function frequencyOf(evidence: string | null): Frequency | null {
  if (!evidence) return null;
  const e = evidence.toLowerCase();
  // Morning-noon-night style: three or four 0/1 doses, separated by - / x or spaces. Count the ones.
  const pattern = e.match(/(?<![\d.])([01])\s*[-–—/x×]\s*([01])\s*[-–—/x×]\s*([01])(?:\s*[-–—/x×]\s*([01]))?(?![\d.])/);
  if (pattern) {
    const taken = pattern.slice(1).reduce((n, d) => n + (d === "1" ? 1 : 0), 0);
    return ({ 1: "OD", 2: "BD", 3: "TDS", 4: "QID" } as Record<number, Frequency>)[taken] ?? null;
  }
  // Words and abbreviations (a letter on either side means it is part of another word); the order matters:
  // "twice daily" is BD, not OD.
  if (/(?<![a-z])(?:sos|prn|when needed|as needed|if required|if needed)(?![a-z])/.test(e)) return "SOS";
  if (/(?<![a-z])(?:q\.?i\.?d|four times|4 times)(?![a-z])/.test(e)) return "QID";
  if (/(?<![a-z])(?:t\.?d\.?s|t\.?i\.?d|three times|3 times|thrice)(?![a-z])/.test(e)) return "TDS";
  if (/(?<![a-z])(?:b\.?d|b\.?i\.?d|twice|two times|2 times)(?![a-z])/.test(e)) return "BD";
  if (/(?<![a-z])(?:h\.?s|at bedtime|bedtime)(?![a-z])/.test(e)) return "HS";
  if (/(?<![a-z])(?:o\.?d|once|daily|every day|one time)(?![a-z])/.test(e)) return "OD";
  return null;
}

/** A value counts only when its evidence is in the text; a number must also appear inside its evidence. */
function proven<T>(text: string, f: Field<T>): T | null {
  if (f.value === null || f.value === undefined || !evidenceFound(text, f.evidence)) return null;
  if (typeof f.value === "number" && !hasNumber(f.evidence, f.value)) return null;
  return f.value;
}

export interface VerifiedItem extends Omit<PrescriptionItem, "id"> {
  quantity_total: number | null;
}

/** Checks every field against the (redacted) text. Returns items ready to save, plus warnings for the review screen. */
export function verifyRx(out: RxLlm, text: string, map: Record<string, string>, today: string) {
  const warnings: string[] = [];
  const back = (s: string | null) => (s === null ? null : restore(s, map).trim());
  const issuedRaw = proven(text, out.issued_on);
  const issued_on = issuedRaw && isoDate.safeParse(issuedRaw).success ? issuedRaw : today;
  const items: VerifiedItem[] = [];
  let anyReview = false;

  out.items.forEach((it, i) => {
    const name = back(proven(text, it.medicine_name));
    if (!name) {
      warnings.push(`Couldn't confirm the medicine name on line ${i + 1}. Please add it by hand if it's missing.`);
      anyReview = true;
      return;
    }
    const strength = back(proven(text, it.strength));
    const dose = back(proven(text, it.dose));
    const modelFrequency = proven(text, it.frequency);
    // The code, not the model, says what the written schedule means (ADR-058): a disagreement is corrected and flagged.
    const written = modelFrequency ? frequencyOf(it.frequency.evidence) : null;
    const frequency = written ?? modelFrequency;
    const form = proven(text, it.form);
    const withFood = proven(text, it.with_food);
    const duration = proven(text, it.duration_days);
    const quantity = proven(text, it.quantity_total);
    const instructions = back(proven(text, it.instructions));
    const timesRaw = proven(text, it.times) ?? [];
    const times = timesRaw.filter((t) => HHMM.test(t));

    const failed: string[] = [];
    const missedWhenGiven = (f: Field<unknown>, got: unknown, label: string) => {
      if (f.value !== null && f.value !== undefined && (got === null || got === undefined)) failed.push(label);
    };
    missedWhenGiven(it.strength, strength, "strength");
    missedWhenGiven(it.dose, dose, "dose");
    missedWhenGiven(it.frequency, frequency, "how often");
    missedWhenGiven(it.duration_days, duration, "duration");
    missedWhenGiven(it.instructions, instructions, "instructions");
    if (timesRaw.length !== (it.times.value ?? []).length || times.length !== timesRaw.length) failed.push("times");
    if (!frequency || (written !== null && written !== modelFrequency)) failed.push("how often");

    const freq = frequency ?? "custom";
    const finalTimes = times.length ? times : freq === "SOS" || freq === "custom" ? [] : [...DEFAULT_TIMES[freq]];
    const needsReview = failed.length > 0;
    anyReview ||= needsReview;
    const unique = [...new Set(failed)];
    if (unique.length) warnings.push(`Please check ${unique.join(", ")} for ${name}${strength ? ` ${strength}` : ""}.`);

    items.push({
      medicine_name: name,
      strength,
      form: form ?? "other",
      dose,
      frequency: freq,
      times: finalTimes,
      with_food: withFood ?? "any",
      duration_days: duration,
      start_date: issued_on,
      end_date: duration ? addDays(issued_on, duration - 1) : null,
      instructions,
      quantity_total: quantity,
      needs_review: needsReview,
      evidence: back(it.medicine_name.evidence),
    });
  });

  return {
    doctor_name: back(proven(text, out.doctor_name)),
    diagnosis: back(proven(text, out.diagnosis)),
    issued_on,
    items,
    warnings,
    anyReview,
  };
}

/** "Allergy alert" when a medicine's name or instructions mention one of the patient's allergies. */
export function allergyWarnings(items: VerifiedItem[], allergies: string[]): string[] {
  const out: string[] = [];
  for (const it of items) {
    const hay = `${it.medicine_name} ${it.instructions ?? ""}`.toLowerCase();
    for (const a of allergies) {
      const allergen = a.trim();
      if (allergen.length >= 3 && hay.includes(allergen.toLowerCase())) out.push(`Allergy alert: ${it.medicine_name} may contain ${allergen}.`);
    }
  }
  return out;
}

const MOCK_TRANSCRIPT = [
  "[mock] Sample prescription",
  "Dr. Rajesh Mehta, MBBS",
  "Date: 2026-10-10",
  "Diagnosis: Type 2 Diabetes",
  "Rx",
  "1. Tab. Metformin 500 mg 1-0-1 after food x 30 days",
  "2. Tab. Telma 40 mg 0-0-1 x 30 days",
].join("\n");

const f = <T>(value: T | null, evidence: string | null): Field<T> => ({ value, evidence });
const MOCK_EXTRACT: RxLlm = {
  doctor_name: f("Dr. [NAME_1]", "Dr. [NAME_1]"),
  diagnosis: f("Type 2 Diabetes", "Diagnosis: Type 2 Diabetes"),
  issued_on: f("2026-10-10", "Date: 2026-10-10"),
  items: [
    {
      medicine_name: f("Metformin", "Tab. Metformin 500 mg"),
      strength: f("500 mg", "Metformin 500 mg"),
      form: f("tablet", "Tab."),
      dose: f("1 tablet", null),
      frequency: f("BD", "1-0-1"),
      times: f([], null),
      with_food: f("after", "after food"),
      duration_days: f(30, "x 30 days"),
      quantity_total: f(null, null),
      instructions: f(null, null),
    },
    {
      medicine_name: f("Telma", "Tab. Telma 40 mg"),
      strength: f("40 mg", "Telma 40 mg"),
      form: f("tablet", "Tab."),
      dose: f(null, null),
      frequency: f("OD", "0-0-1"),
      times: f(["21:00"], "0-0-1"),
      with_food: f(null, null),
      duration_days: f(30, "x 30 days"),
      quantity_total: f(null, null),
      instructions: f(null, null),
    },
  ],
};

export async function extractPrescription(
  user: { id: string; fullName: string | null; allergies: string[] },
  sb: SupabaseClient,
  filePath: string,
): Promise<PrescriptionExtractRes> {
  const { mime } = checkUploadPath(user.id, filePath);
  const bytes = await downloadUpload("prescriptions", filePath);
  const doc = await readDocumentText({
    bytes,
    mime,
    feature: "rx",
    userId: user.id,
    inputRef: `prescriptions/${filePath}`,
    mockTranscript: MOCK_TRANSCRIPT,
    unavailableMessage: "Prescription scanning isn't available yet. Please add the medicines by hand.",
  });

  const { text, map } = redact(doc.text, { knownNames: user.fullName ? [user.fullName] : [] });
  const today = istDayOf(new Date().toISOString());
  const { object, ai } = await runAi({
    feature: "rx_extract",
    kind: "text",
    schema: RxLlm,
    system: RX_EXTRACT_SYSTEM,
    prompt: rxExtractPrompt(text),
    promptVersion: RX_EXTRACT_PROMPT_VERSION,
    sources: [],
    userId: user.id,
    inputRef: `prescriptions/${filePath}`,
    mock: MOCK_EXTRACT,
    statusOf: (o) => (verifyRx(o, text, map, today).anyReview ? "needs_review" : "ok"),
  });

  const rx = verifyRx(object, text, map, today);
  const warnings = [...rx.warnings, ...allergyWarnings(rx.items, user.allergies)];
  if (doc.source === "transcription") warnings.unshift("Read from a photo: please check every medicine against your paper prescription.");

  const { data: saved, error } = await sb
    .from("prescriptions")
    .insert({ patient_id: user.id, source: "upload", file_path: filePath, doctor_name: rx.doctor_name, diagnosis: rx.diagnosis, issued_on: rx.issued_on })
    .select("id")
    .single();
  if (error || !saved) throw error ?? new Error("prescription not saved");
  const prescriptionId = (saved as { id: string }).id;

  let ids: string[] = [];
  if (rx.items.length) {
    const rows = rx.items.map((it) => ({
      prescription_id: prescriptionId,
      patient_id: user.id,
      medicine_name: it.medicine_name,
      strength: it.strength,
      form: it.form,
      dose: it.dose,
      frequency: it.frequency,
      times: it.times,
      with_food: it.with_food,
      duration_days: it.duration_days,
      quantity_total: it.quantity_total,
      start_date: it.start_date,
      end_date: it.end_date,
      instructions: it.instructions,
      active: true,
    }));
    const { data: itemRows, error: itemError } = await sb.from("prescription_items").insert(rows).select("id");
    if (itemError || !itemRows) {
      // Nothing half-saved (SPEC §3 step 6).
      await sb.from("prescriptions").delete().eq("id", prescriptionId);
      throw itemError ?? new Error("prescription items not saved");
    }
    ids = (itemRows as { id: string }[]).map((r) => r.id);
  }

  return {
    prescription_id: prescriptionId,
    doctor_name: rx.doctor_name,
    diagnosis: rx.diagnosis,
    issued_on: rx.issued_on,
    items: rx.items.map((it, i) => ({
      id: ids[i],
      medicine_name: it.medicine_name,
      strength: it.strength,
      form: it.form,
      dose: it.dose,
      frequency: it.frequency,
      times: it.times,
      with_food: it.with_food,
      duration_days: it.duration_days,
      start_date: it.start_date,
      end_date: it.end_date,
      instructions: it.instructions,
      needs_review: it.needs_review,
      evidence: it.evidence,
    })),
    warnings,
    ai,
  };
}
