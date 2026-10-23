import "server-only";
import { z } from "zod";
import { isoDate, Language, type LabValue, type LabValueCorrectReq, type LabValueCorrectRes, type ReportAnalyzeRes } from "@vyana/shared";
import { runAi } from "./ai";
import type { AuthedUser } from "./auth";
import { checkUploadPath, downloadUpload, readDocumentText } from "./documents";
import { AppError, notFound, upstream } from "./errors";
import { log } from "./log";
import {
  REPORT_EXTRACT_PROMPT_VERSION,
  REPORT_EXTRACT_SYSTEM,
  REPORT_SUMMARY_PROMPT_VERSION,
  REPORT_SUMMARY_SYSTEM,
  reportExtractPrompt,
  reportSummaryPrompt,
} from "./prompts/documents";
import { hasDiagnosisLanguage, hasDosePattern } from "./safety/blocklists";
import { redact, restore } from "./safety/redact";
import { evidenceFound, field, hasNumber } from "./safety/verbatim";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Lab report reading (SPEC §4, §2A, ADR-041/042): values quote the report, flags are computed in code, the summary
 * is written from verified values only and checked for diagnosis or dose wording.
 */

export const ReportLlm = z.object({
  lab_name: field(z.string()),
  report_date: field(z.string()),
  values: z.array(
    z.object({
      test_name: z.string(),
      value: z.number().nullable(),
      value_text: z.string().nullable(),
      unit: z.string().nullable(),
      ref_low: z.number().nullable(),
      ref_high: z.number().nullable(),
      evidence: z.string(),
    }),
  ),
});
export type ReportLlm = z.infer<typeof ReportLlm>;
const Summary = z.object({ summary: z.string() });

/** Flags come from code only (§2A rule 4). One-sided ranges compare the side that exists. */
export function flagFor(value: number | null, low: number | null, high: number | null): LabValue["flag"] {
  if (value === null || (low === null && high === null)) return "unknown";
  if (low !== null && value < low) return "low";
  if (high !== null && value > high) return "high";
  return "normal";
}

/** A number counts only if it is written inside its row's evidence ("7.4" in "HbA1c 7.4 % 4.0 - 5.6"). */
function numberIn(evidence: string, n: number | null): number | null {
  if (n === null) return null;
  return hasNumber(evidence, n) ? n : null;
}

export function verifyReport(out: ReportLlm, text: string, map: Record<string, string>) {
  const values: LabValue[] = [];
  let anyReview = false;
  for (const row of out.values) {
    const name = row.test_name.trim();
    if (!name || !evidenceFound(text, row.evidence) || !evidenceFound(row.evidence, name)) {
      anyReview = true;
      continue;
    }
    const value = numberIn(row.evidence, row.value);
    const low = numberIn(row.evidence, row.ref_low);
    const high = numberIn(row.evidence, row.ref_high);
    const valueText = row.value_text && evidenceFound(row.evidence, row.value_text) ? row.value_text.trim() : null;
    const unit = row.unit && evidenceFound(row.evidence, row.unit) ? row.unit.trim() : null;
    // A reference range is low-then-high: when the model swapped the two bounds, both numbers still pass the
    // evidence check (both are printed in the row), so the swap is caught here. A flag from an inverted range
    // would be wrong, so the row is never flagged and goes to review instead.
    const rangeInverted = low !== null && high !== null && low > high;
    const needsReview =
      value !== row.value || low !== row.ref_low || high !== row.ref_high || (row.value_text !== null && valueText === null) || rangeInverted;
    anyReview ||= needsReview;
    values.push({
      test_name: restore(name, map),
      value,
      value_text: valueText,
      unit,
      ref_low: low,
      ref_high: high,
      flag: rangeInverted ? "unknown" : flagFor(value, low, high),
      needs_review: needsReview,
      evidence: restore(row.evidence.trim(), map),
    });
  }
  const proven = (f: { value: string | null; evidence: string | null }) =>
    f.value && evidenceFound(text, f.evidence) ? restore(f.value.trim(), map) : null;
  const date = proven(out.report_date);
  return { lab_name: proven(out.lab_name), report_date: date && isoDate.safeParse(date).success ? date : null, values, anyReview };
}

const describeRow = (v: LabValue) => {
  const range = v.ref_low !== null || v.ref_high !== null ? ` (range ${v.ref_low ?? "?"} to ${v.ref_high ?? "?"})` : "";
  const where = v.flag === "high" ? "above the range" : v.flag === "low" ? "below the range" : v.flag === "normal" ? "within the range" : "no range to compare";
  return `- ${v.test_name}: ${v.value ?? v.value_text ?? "not readable"} ${v.unit ?? ""}${range}: ${where}`.replace(/ +/g, " ");
};

/** The fallback when the model's summary can't be used: facts only, no interpretation. */
export function templateSummary(values: LabValue[]): string {
  const out = values.filter((v) => v.flag === "high" || v.flag === "low");
  if (!values.length) return "No test values could be read from this report. Please check the report and discuss it with your doctor.";
  if (!out.length) return `All ${values.length} values that could be read are within their reference ranges. Please discuss these results with your doctor.`;
  return `${out.length} of ${values.length} values are outside their reference range: ${out.map((v) => v.test_name).join(", ")}. Please discuss these results with your doctor.`;
}

const summaryOk = (s: string) => s.trim().length > 0 && !hasDiagnosisLanguage(s) && !hasDosePattern(s);

async function writeSummary(values: LabValue[], language: Language, userId: string): Promise<{ summary: string; fallback: boolean }> {
  if (!values.length) return { summary: templateSummary(values), fallback: true };
  const prompt = reportSummaryPrompt(values.map(describeRow), language);
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { object } = await runAi({
      feature: "report_summary",
      kind: "text",
      schema: Summary,
      system: REPORT_SUMMARY_SYSTEM,
      prompt,
      promptVersion: REPORT_SUMMARY_PROMPT_VERSION,
      sources: [],
      userId,
      mock: { summary: templateSummary(values) },
      statusOf: (o) => (summaryOk(o.summary) ? "ok" : "rejected"),
    });
    if (summaryOk(object.summary)) return { summary: object.summary.trim(), fallback: false };
  }
  return { summary: templateSummary(values), fallback: true };
}

const MOCK_TRANSCRIPT = [
  "[mock] Sample Diagnostics",
  "Report date: 2026-10-05",
  "Test Result Unit Reference range",
  "HbA1c 7.4 % 4.0 - 5.6",
  "Fasting Blood Sugar 115 mg/dL 70 - 100",
  "Haemoglobin 13.5 g/dL 13.0 - 17.0",
].join("\n");
const MOCK_EXTRACT: ReportLlm = {
  lab_name: { value: "[mock] Sample Diagnostics", evidence: "[mock] Sample Diagnostics" },
  report_date: { value: "2026-10-05", evidence: "Report date: 2026-10-05" },
  values: [
    { test_name: "HbA1c", value: 7.4, value_text: null, unit: "%", ref_low: 4, ref_high: 5.6, evidence: "HbA1c 7.4 % 4.0 - 5.6" },
    { test_name: "Fasting Blood Sugar", value: 115, value_text: null, unit: "mg/dL", ref_low: 70, ref_high: 100, evidence: "Fasting Blood Sugar 115 mg/dL 70 - 100" },
    { test_name: "Haemoglobin", value: 13.5, value_text: null, unit: "g/dL", ref_low: 13, ref_high: 17, evidence: "Haemoglobin 13.5 g/dL 13.0 - 17.0" },
  ],
};

const followUpsOf = (values: LabValue[]) => values.filter((v) => v.flag === "high" || v.flag === "low").map((v) => v.test_name);

type LabValueRow = {
  id: string;
  report_id: string;
  patient_id: string;
  test_name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: LabValue["flag"];
};

/** The corrected value: the patient's reading, the stored range, and a flag computed in code (§2A rule 4). */
export function applyCorrection(row: LabValueRow, body: LabValueCorrectReq): LabValue {
  const value = body.value;
  return {
    id: row.id,
    test_name: row.test_name,
    value,
    value_text: body.value_text?.trim() || null,
    unit: body.unit === undefined ? row.unit : body.unit?.trim() || null,
    ref_low: row.ref_low,
    ref_high: row.ref_high,
    flag: flagFor(value, row.ref_low, row.ref_high),
    needs_review: false,
    corrected: true,
  };
}

/** POST /api/reports/values/correct (SPEC §4b, ADR-062): a patient corrects one value of their own report. */
export async function correctLabValue({ sb, user }: Pick<AuthedUser, "sb" | "user">, body: LabValueCorrectReq): Promise<LabValueCorrectRes> {
  // Read as the caller: RLS shows a patient only their own rows.
  const { data, error } = await sb
    .from("lab_values")
    .select("id, report_id, patient_id, test_name, value, value_text, unit, ref_low, ref_high, flag")
    .eq("id", body.value_id)
    .maybeSingle();
  if (error) throw error;
  const row = data as LabValueRow | null;
  if (!row || row.patient_id !== user.id) throw notFound("This value was not found.");

  const next = applyCorrection(row, body);
  const before = { value: row.value, value_text: row.value_text, unit: row.unit, flag: row.flag };
  const admin = supabaseAdmin();
  const { error: updateError } = await admin
    .from("lab_values")
    .update({ value: next.value, value_text: next.value_text, unit: next.unit, flag: next.flag })
    .eq("id", row.id);
  if (updateError) throw updateError;

  // Every value of the report, with this one replaced, for the summary and the saved extraction.
  const { data: rest, error: restError } = await admin
    .from("lab_values")
    .select("id, report_id, patient_id, test_name, value, value_text, unit, ref_low, ref_high, flag")
    .eq("report_id", row.report_id)
    .order("created_at");
  if (restError) throw restError;
  const values = ((rest ?? []) as LabValueRow[]).map((r) => (r.id === row.id ? next : { ...r }) as LabValue);
  const summary = templateSummary(values);
  const followUps = followUpsOf(values);

  const { data: report } = await admin.from("lab_reports").select("extracted_json").eq("id", row.report_id).maybeSingle();
  const extracted = (report as { extracted_json: { values?: LabValue[] } | null } | null)?.extracted_json ?? {};
  const savedValues = (extracted.values ?? []).map((v) => (v.id === row.id ? { ...v, ...next, evidence: v.evidence } : v));
  const { error: reportError } = await admin
    .from("lab_reports")
    .update({ summary, extracted_json: { ...extracted, values: savedValues, follow_up_tests: followUps } })
    .eq("id", row.report_id);
  if (reportError) throw reportError;

  // The old value is kept for the record (no model call: model null).
  const after = { value: next.value, value_text: next.value_text, unit: next.unit, flag: next.flag };
  const { error: runError } = await admin.from("ai_runs").insert({
    user_id: user.id,
    feature: "lab_value_correction",
    model: null,
    input_ref: `lab_values/${row.id}`,
    output_json: { report_id: row.report_id, before, after },
    status: "ok",
  });
  if (runError) log({ event: "lab_correction_record_failed" });

  log({ event: "lab_value_corrected", flag_changed: before.flag !== after.flag });
  return { report_id: row.report_id, value: next, summary, follow_up_tests: followUps };
}

export async function analyzeReport(
  authed: Pick<AuthedUser, "user" | "profile">,
  filePath: string,
  requestDate: string | undefined,
): Promise<ReportAnalyzeRes> {
  // The caller's language, settled here like the other services settle it, not in the route.
  const user = { id: authed.user.id, fullName: authed.profile.full_name, language: Language.catch("en").parse(authed.profile.preferred_language) };
  const { mime } = checkUploadPath(user.id, filePath);
  const bytes = await downloadUpload("lab-reports", filePath);
  const admin = supabaseAdmin();

  // Created first so the app can show progress (SPEC §4 step 2).
  const { data: report, error } = await admin
    .from("lab_reports")
    .insert({ patient_id: user.id, file_path: filePath, status: "processing" })
    .select("id")
    .single();
  if (error || !report) throw error ?? new Error("lab report not created");
  const reportId = (report as { id: string }).id;

  try {
    const doc = await readDocumentText({
      bytes,
      mime,
      feature: "report",
      userId: user.id,
      inputRef: `lab-reports/${filePath}`,
      mockTranscript: MOCK_TRANSCRIPT,
      unavailableMessage: "Report reading isn't available yet. Please add the values by hand.",
    });
    const { text, map } = redact(doc.text, { knownNames: user.fullName ? [user.fullName] : [] });
    const { object, ai } = await runAi({
      feature: "report_extract",
      kind: "text",
      schema: ReportLlm,
      system: REPORT_EXTRACT_SYSTEM,
      prompt: reportExtractPrompt(text),
      promptVersion: REPORT_EXTRACT_PROMPT_VERSION,
      sources: [],
      userId: user.id,
      inputRef: `lab-reports/${filePath}`,
      mock: MOCK_EXTRACT,
      statusOf: (o) => (verifyReport(o, text, map).anyReview ? "needs_review" : "ok"),
    });

    const verified = verifyReport(object, text, map);
    const reportDate = verified.report_date ?? requestDate ?? null;
    const { summary } = await writeSummary(verified.values, user.language, user.id);
    const followUps = followUpsOf(verified.values);

    if (verified.values.length) {
      const rows = verified.values.map((v) => ({
        report_id: reportId,
        patient_id: user.id,
        test_name: v.test_name,
        value: v.value,
        value_text: v.value_text,
        unit: v.unit,
        ref_low: v.ref_low,
        ref_high: v.ref_high,
        flag: v.flag,
        measured_on: reportDate,
      }));
      // The ids come back in insert order; the review screen corrects a value by its id (ADR-062).
      const { data: saved, error: valuesError } = await admin.from("lab_values").insert(rows).select("id");
      if (valuesError) throw valuesError;
      const ids = (saved ?? []) as { id: string }[];
      if (ids.length === verified.values.length) verified.values = verified.values.map((v, i) => ({ id: ids[i].id, ...v }));
    }
    const { error: doneError } = await admin
      .from("lab_reports")
      .update({ status: "done", lab_name: verified.lab_name, report_date: reportDate, summary, extracted_json: { values: verified.values, follow_up_tests: followUps } })
      .eq("id", reportId);
    if (doneError) throw doneError;

    return { report_id: reportId, lab_name: verified.lab_name, report_date: reportDate, summary, values: verified.values, follow_up_tests: followUps, ai };
  } catch (err) {
    await admin.from("lab_reports").update({ status: "failed" }).eq("id", reportId);
    log({ event: "report_analyze_failed", error: err instanceof Error ? err.name : "Error" });
    if (err instanceof AppError) throw err;
    throw upstream("Could not read this report. Try a clearer photo or a PDF.");
  }
}
