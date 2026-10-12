// packages/shared/src/db/queries/doses.ts
// Owner: Vaibhav Parmar

import type { DbDoseLog } from "../types";
import { daysAgoIso, requireUserId, unwrap, type Sb } from "./helpers";

export type DoseStatus = "taken" | "missed" | "skipped";

export type LogDoseInput = {
  item_id: string;
  /** The time the dose was due, as an ISO timestamp. Logging the same dose again updates it. */
  scheduled_for: string;
  status: DoseStatus;
};

export type Adherence = { taken: number; missed: number; percent: number };

/** Records a dose as taken, missed or skipped. One row per medicine and due time. */
export async function logDose(sb: Sb, input: LogDoseInput): Promise<DbDoseLog> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("dose_logs")
      .upsert(
        { patient_id: patientId, item_id: input.item_id, scheduled_for: input.scheduled_for, status: input.status, logged_at: new Date().toISOString() },
        { onConflict: "item_id,scheduled_for" }
      )
      .select()
      .single()
  );
}

/** Dose logs due between `from` and `to` (ISO timestamps, `to` excluded), oldest first. */
export async function listDoseLogs(sb: Sb, from: string, to: string): Promise<DbDoseLog[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("dose_logs").select("*").eq("patient_id", patientId).gte("scheduled_for", from).lt("scheduled_for", to).order("scheduled_for")
  );
}

/**
 * Share of doses taken among the doses that were taken or missed. A skipped dose is a choice, so it
 * is left out; with nothing logged the percentage is 0.
 */
export function computeAdherence(logs: Pick<DbDoseLog, "status">[]): Adherence {
  const taken = logs.filter((l) => l.status === "taken").length;
  const missed = logs.filter((l) => l.status === "missed").length;
  const due = taken + missed;
  return { taken, missed, percent: due === 0 ? 0 : Math.round((taken / due) * 100) };
}

/** Adherence over the last `days` days. */
export async function getAdherence(sb: Sb, days: number, now: Date = new Date()): Promise<Adherence> {
  const logs = await listDoseLogs(sb, daysAgoIso(days, now), now.toISOString());
  return computeAdherence(logs);
}
