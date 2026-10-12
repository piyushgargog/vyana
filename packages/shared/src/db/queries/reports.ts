// packages/shared/src/db/queries/reports.ts
// Owner: Vaibhav Parmar

import type { DbLabReport, DbLabValue } from "../types";
import { requireUserId, unwrap, type Sb } from "./helpers";

export type LabReportWithValues = DbLabReport & { lab_values: DbLabValue[] };

/** The signed-in patient's lab reports, newest first. A doctor or caregiver passes `patientId`. */
export async function listLabReports(sb: Sb, patientId?: string): Promise<DbLabReport[]> {
  const id = patientId ?? (await requireUserId(sb));
  return unwrap(
    await sb.from("lab_reports").select("*").eq("patient_id", id).order("report_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
  );
}

export async function getLabReport(sb: Sb, id: string): Promise<LabReportWithValues> {
  return unwrap(await sb.from("lab_reports").select("*, lab_values(*)").eq("id", id).single());
}

/** Every measurement of one test (for example 'HbA1c') over time, oldest first, for the trend chart. */
export async function listLabValueHistory(sb: Sb, testName: string): Promise<DbLabValue[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("lab_values").select("*").eq("patient_id", patientId).ilike("test_name", testName).order("measured_on", { ascending: true, nullsFirst: false })
  );
}

/** When each test was last measured, keyed by lower-case test name (`YYYY-MM-DD`). For the follow-up test reminders. */
export async function listLastLabDates(sb: Sb): Promise<Record<string, string>> {
  const patientId = await requireUserId(sb);
  const rows = unwrap(await sb.from("lab_values").select("test_name, measured_on").eq("patient_id", patientId).not("measured_on", "is", null));
  const last: Record<string, string> = {};
  for (const row of rows) {
    const key = row.test_name.trim().toLowerCase();
    if (row.measured_on && (!last[key] || row.measured_on > last[key])) last[key] = row.measured_on;
  }
  return last;
}
