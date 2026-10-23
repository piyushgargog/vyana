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

/** One row of the plans catalogue (migration 0016): a plan and its limits. A limit of null means the plan sets none. */
export interface PlanRow {
  id: string;
  name: string;
  daily_ai_calls: number | null;
  max_profiles: number | null;
  features: Json;
}

/** The order the plans page shows the catalogue in; a plan added later sorts after these. */
const PLAN_ORDER = ["free", "family", "clinic"];

/**
 * Every plan in the catalogue with its limits, in display order. The plans
 * table is readable signed out (it is the public price page's data), so this
 * answers for signed-out visitors too.
 */
export async function listPlans(sb: Sb): Promise<PlanRow[]> {
  const rows = unwrap(await sb.from("plans").select("id, name, daily_ai_calls, max_profiles, features")) as PlanRow[];
  const rank = (id: string) => {
    const i = PLAN_ORDER.indexOf(id);
    return i === -1 ? PLAN_ORDER.length : i;
  };
  return [...rows].sort((a, b) => rank(a.id) - rank(b.id));
}
