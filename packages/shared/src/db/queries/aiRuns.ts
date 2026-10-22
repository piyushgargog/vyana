// packages/shared/src/db/queries/aiRuns.ts
// "Report a mistake" on AI output (plan 2A rules 7 and 8). Owner: Vaibhav Parmar

import type { DbAiRun } from "../types";
import { unwrap, type Sb } from "./helpers";

/**
 * Marks one of the user's own AI runs as reported, with an optional note (up to 1000 characters). The
 * database lets a user change only the status (to 'reported') and the note of their own runs.
 */
export async function reportAiMistake(sb: Sb, aiRunId: string, note?: string): Promise<DbAiRun> {
  const patch = note && note.trim() !== "" ? { status: "reported", report_note: note.trim() } : { status: "reported" };
  return unwrap(await sb.from("ai_runs").update(patch).eq("id", aiRunId).select().single());
}

/** The signed-in user's own AI totals for today (Asia/Kolkata), from `my_ai_usage_today` (migration 0015). */
export interface MyAiUsageToday {
  calls: number;
  input_tokens: number;
  output_tokens: number;
}

/**
 * What the user's AI calls have cost today: the "AI uses left today" line reads this.
 * The database function filters by the caller itself, so it can only ever hand back
 * their own totals; with no runs today it returns one row of zeros.
 */
export async function getMyAiUsageToday(sb: Sb): Promise<MyAiUsageToday> {
  const rows = unwrap(await sb.rpc("my_ai_usage_today")) as MyAiUsageToday[];
  return rows[0] ?? { calls: 0, input_tokens: 0, output_tokens: 0 };
}
