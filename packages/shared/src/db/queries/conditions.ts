// packages/shared/src/db/queries/conditions.ts
// Owner: Vaibhav Parmar

import type { TablesInsert, TablesUpdate } from "../database.types";
import type { DbCondition } from "../types";
import { check, requireUserId, unwrap, type Sb } from "./helpers";

export type ConditionInput = Pick<TablesInsert<"conditions">, "name" | "diagnosed_on" | "notes">;
/** A patient edits these only: who diagnosed them (`source`, `diagnosed_by`) is not theirs to change. */
export type ConditionPatch = Pick<TablesUpdate<"conditions">, "name" | "diagnosed_on" | "notes" | "active">;

export async function listConditions(sb: Sb): Promise<DbCondition[]> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("conditions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }));
}

/** A patient adds a condition themselves (source 'patient'). Conditions from a doctor's diagnosis are added by the server. */
export async function addCondition(sb: Sb, input: ConditionInput): Promise<DbCondition> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("conditions").insert({ ...input, patient_id: patientId, source: "patient" }).select().single());
}

export async function updateCondition(sb: Sb, id: string, patch: ConditionPatch): Promise<DbCondition> {
  return unwrap(await sb.from("conditions").update(patch).eq("id", id).select().single());
}

export async function deleteCondition(sb: Sb, id: string): Promise<void> {
  check(await sb.from("conditions").delete().eq("id", id));
}
