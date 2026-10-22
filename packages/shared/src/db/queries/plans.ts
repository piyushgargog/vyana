// packages/shared/src/db/queries/plans.ts
// Plans and limits (issue #301): which plan the signed-in user is on, with its limits.
// Owner: Vaibhav Parmar

import type { Json } from "../database.types";
import { unwrap, type Sb } from "./helpers";

/** The caller's plan row with its limits, from `current_plan()` (migration 0016). A limit of null means the plan sets none. */
export interface CurrentPlan {
  plan_id: string;
  name: string;
  daily_ai_calls: number | null;
  max_profiles: number | null;
  features: Json;
  since: string;
  source: string;
}

/**
 * The signed-in user's plan and limits, or null when there is no plan row (not
 * signed in). The database function filters by the caller itself, so it can
 * only ever hand back their own plan.
 */
export async function getCurrentPlan(sb: Sb): Promise<CurrentPlan | null> {
  const rows = unwrap(await sb.rpc("current_plan")) as CurrentPlan[];
  return rows[0] ?? null;
}
