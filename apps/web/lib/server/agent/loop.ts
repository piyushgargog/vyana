import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { CarePlan, findLastDone } from "@vyana/shared";
import { istDate } from "../data/missed-doses";
import {
  labRecheckRule,
  missedDosePatternRule,
  refillDueRule,
  type ProposalDraft,
} from "./rules";

/**
 * The care agent loop (issue #415): run the rules of `rules.ts` over every patient and write the
 * proposals they return. Rules decide; this loop only reads what they need, writes what they
 * answered, and closes what has expired. A model is never involved.
 *
 * One run looks at at most MAX_PATIENTS patients (the first ones by id, so a run is bounded and
 * the next run starts from the same place). Counts only leave this module: no medicine name and
 * no health value is ever logged or returned.
 */

export const MAX_PATIENTS = 200;
const PAGE = 100;
const CHUNK = 100;
const DAY_MS = 86_400_000;

/** The rule that wrote a proposal, in the versioned shape the table already uses (0017 tests). */
const RULE_IDS: Record<ProposalDraft["kind"], string> = {
  refill_due: "refill-v1",
  lab_recheck: "lab-v1",
  missed_dose_pattern: "missed-v1",
};

interface ItemRow {
  id: string;
  medicine_name: string;
  strength: string | null;
  dose: string | null;
  times: string[];
  quantity_total: number | null;
  refill_alert_days: number | null;
  active: boolean;
  end_date: string | null;
}

interface LogRow {
  item_id: string;
  scheduled_for: string;
  status: "taken" | "missed" | "skipped";
}

interface LabRow {
  test_name: string;
  measured_on: string;
  report_id: string;
}

const chunks = <T>(list: T[]): T[][] =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

/** Runs a query for many ids, `CHUNK` ids per request (a long `in (...)` list overflows a URL), and joins the rows. */
async function readChunked<T>(
  ids: string[],
  query: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await query(part);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

/** The patients of one run: the first MAX_PATIENTS by id, paged so no single read is unbounded. */
async function listPatients(sb: SupabaseClient): Promise<string[]> {
  const ids: string[] = [];
  for (let from = 0; ids.length < MAX_PATIENTS; from += PAGE) {
    const { data, error } = await sb
      .from("profiles")
      .select("id")
      .eq("role", "patient")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    ids.push(...(data ?? []).map((r) => r.id as string));
    if (!data || data.length < PAGE) break;
  }
  return ids.slice(0, MAX_PATIENTS);
}

/**
 * The last time a follow-up test was measured, and the report that holds that result (the rule's
 * evidence). The date is matched the way the reminders match it (`findLastDone`: names compare
 * ignoring case, spaces and punctuation); the report is the newest row on that date.
 */
function lastLab(test: string, rows: LabRow[]): { date: string; reportId: string | null } | null {
  const byName: Record<string, string> = {};
  for (const r of rows) {
    const key = r.test_name.toLowerCase();
    if (!byName[key] || r.measured_on > byName[key]) byName[key] = r.measured_on;
  }
  const date = findLastDone(test, byName);
  if (date === null) return null;
  const onThatDate = rows.filter((r) => r.measured_on === date);
  const exact = onThatDate.find((r) => r.test_name.toLowerCase() === test.toLowerCase());
  return { date, reportId: (exact ?? onThatDate[0])?.report_id ?? null };
}

/** Every draft the three rules return for one patient, from only the rows they need. */
async function draftsForPatient(
  sb: SupabaseClient,
  patientId: string,
  today: string,
): Promise<ProposalDraft[]> {
  const { data: itemData, error: itemError } = await sb
    .from("prescription_items")
    .select("id, medicine_name, strength, dose, times, quantity_total, refill_alert_days, active, end_date")
    .eq("patient_id", patientId)
    .eq("active", true);
  if (itemError) throw itemError;
  const items = (itemData ?? []) as ItemRow[];

  // The refill rule counts every dose ever logged as taken against the pack (the same rows the
  // refill alerts read), so the loop reads an item's whole log, not a window; the missed-dose
  // rule picks its own last seven days out of the same rows.
  const logs =
    items.length === 0
      ? []
      : await readChunked<LogRow>(items.map((i) => i.id), (part) =>
          sb.from("dose_logs").select("item_id, scheduled_for, status").in("item_id", part),
        );
  const logsOf = (itemId: string) => logs.filter((l) => l.item_id === itemId);

  const { data: linkData, error: linkError } = await sb
    .from("care_links")
    .select("caregiver_id")
    .eq("patient_id", patientId)
    .eq("status", "active")
    .limit(1);
  if (linkError) throw linkError;
  const hasCaregiver = (linkData ?? []).length > 0;

  const drafts: ProposalDraft[] = [];
  for (const item of items) {
    const refill = refillDueRule({ today, item, doseLogs: logsOf(item.id) });
    if (refill) drafts.push(refill);
    const missed = missedDosePatternRule({
      today,
      itemId: item.id,
      medicineName: item.medicine_name,
      logs: logsOf(item.id),
      hasCaregiver,
    });
    if (missed) drafts.push(missed);
  }

  const { data: planData, error: planError } = await sb
    .from("care_plans")
    .select("plan_json")
    .eq("patient_id", patientId)
    .eq("status", "approved");
  if (planError) throw planError;
  const followUps = (planData ?? []).flatMap((row) => {
    const parsed = CarePlan.safeParse(row.plan_json);
    return parsed.success ? parsed.data.follow_up_tests : [];
  });
  if (followUps.length > 0) {
    const { data: labData, error: labError } = await sb
      .from("lab_values")
      .select("test_name, measured_on, report_id")
      .eq("patient_id", patientId)
      .not("measured_on", "is", null);
    if (labError) throw labError;
    const labRows = (labData ?? []) as LabRow[];
    for (const followUp of followUps) {
      const last = lastLab(followUp.test, labRows);
      const draft = labRecheckRule({
        today,
        followUp,
        lastMeasuredOn: last?.date ?? null,
        reportId: last?.reportId ?? null,
      });
      if (draft) drafts.push(draft);
    }
  }
  return drafts;
}

export interface CareAgentLoopResult {
  /** Patients looked at this run. */
  patients: number;
  /** Proposals written this run. */
  created: number;
  /** Open proposals the database closed as expired at the end of the run. */
  expired: number;
}

/**
 * One loop run: for each patient, ask the rules, insert each draft that has no open proposal
 * with the same dedupe key (the table's partial unique index is the backstop if two runs race),
 * then let `expire_proposals()` close what has run out.
 */
export async function runCareAgentLoop(sb: SupabaseClient, now: Date = new Date()): Promise<CareAgentLoopResult> {
  const today = istDate(now);
  const patientIds = await listPatients(sb);
  let created = 0;

  for (const patientId of patientIds) {
    const drafts = await draftsForPatient(sb, patientId, today);
    if (drafts.length === 0) continue;

    const { data: openData, error: openError } = await sb
      .from("agent_proposals")
      .select("dedupe_key")
      .eq("patient_id", patientId)
      .eq("status", "pending");
    if (openError) throw openError;
    const open = new Set((openData ?? []).map((r) => r.dedupe_key as string | null));

    for (const draft of drafts) {
      if (open.has(draft.dedupe_key)) continue;
      const { error } = await sb.from("agent_proposals").insert({
        patient_id: patientId,
        kind: draft.kind,
        title: draft.title,
        reason: draft.reason,
        payload: draft.payload,
        evidence: draft.evidence,
        status: "pending",
        rule_id: RULE_IDS[draft.kind],
        dedupe_key: draft.dedupe_key,
        expires_at: new Date(now.getTime() + draft.expires_in_days * DAY_MS).toISOString(),
      });
      if (error) {
        // A proposal with this key was written between the read and this insert (a second run
        // at the same moment): the unique index refused it, which is the dedupe working.
        if ((error as { code?: string }).code === "23505") continue;
        throw error;
      }
      open.add(draft.dedupe_key);
      created += 1;
    }
  }

  const { data: expiredCount, error: expireError } = await sb.rpc("expire_proposals");
  if (expireError) throw expireError;

  return { patients: patientIds.length, created, expired: typeof expiredCount === "number" ? expiredCount : 0 };
}
