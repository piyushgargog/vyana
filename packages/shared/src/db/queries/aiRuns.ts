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
