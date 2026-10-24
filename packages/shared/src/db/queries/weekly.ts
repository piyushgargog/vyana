// packages/shared/src/db/queries/weekly.ts
// Weekly summaries (issue #495 step 4): rows filled nightly by fill_weekly_summaries() —
// screens read, they never recompute. Row level security decides who sees a row: the
// patient, or a caregiver the patient shared the adherence scope with.
// Owner: Vaibhav Parmar

import type { DbWeeklySummary } from "../types";
import { unwrapOrNull, type Sb } from "./helpers";

/**
 * The summary of one patient for the week starting on `weekStart` (a Monday, `YYYY-MM-DD`),
 * or null when that week has not been filled yet.
 */
export async function getWeeklySummary(sb: Sb, patientId: string, weekStart: string): Promise<DbWeeklySummary | null> {
  return unwrapOrNull(
    await sb.from("weekly_summaries").select("*").eq("patient_id", patientId).eq("week_start", weekStart).maybeSingle()
  );
}
