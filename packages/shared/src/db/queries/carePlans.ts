// packages/shared/src/db/queries/carePlans.ts
// Owner: Vaibhav Parmar

import type { Json } from "../database.types";
import type { DbCarePlan } from "../types";
import { requireUserId, unwrap, unwrapOrNull, type Sb } from "./helpers";

/** The care plan document (`plan_json`, plan 6.5). */
export type PlanJson = Exclude<Json, null>;

/** The newest care plan of a condition that the caller may see (a patient sees approved ones only). */
export async function getCarePlan(sb: Sb, conditionId: string): Promise<DbCarePlan | null> {
  return unwrapOrNull(
    await sb.from("care_plans").select("*").eq("condition_id", conditionId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  );
}

/** The signed-in patient's care plans, newest first. A doctor passes `patientId` to review a patient's drafts. */
export async function listCarePlans(sb: Sb, patientId?: string): Promise<DbCarePlan[]> {
  const id = patientId ?? (await requireUserId(sb));
  return unwrap(await sb.from("care_plans").select("*").eq("patient_id", id).order("created_at", { ascending: false }));
}

/** A doctor approves a plan (with their edits to `plan_json`): sets status, reviewer and review time. */
export async function approveCarePlan(sb: Sb, id: string, plan: PlanJson): Promise<DbCarePlan> {
  const doctorId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("care_plans")
      .update({ status: "approved", plan_json: plan, reviewed_by: doctorId, reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
  );
}
