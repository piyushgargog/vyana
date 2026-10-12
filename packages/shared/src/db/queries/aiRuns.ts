// packages/shared/src/db/queries/aiRuns.ts
// "Report a mistake" on AI output (plan 2A rules 7 and 8). Owner: Vaibhav Parmar

import type { DbAiRun } from "../types";
import { unwrap, type Sb } from "./helpers";

/**
 * Marks one of the user's own AI runs as reported. The database lets a user change only the status of
 * their own runs, and only to 'reported'. `ai_runs` has no column for a note, so `note` is not stored
 * yet; it is accepted so the screens can already ask for it.
 */
export async function reportAiMistake(sb: Sb, aiRunId: string, _note?: string): Promise<DbAiRun> {
  return unwrap(await sb.from("ai_runs").update({ status: "reported" }).eq("id", aiRunId).select().single());
}
