// packages/shared/src/db/queries/conditions.ts
// Owner: Vaibhav Parmar

import type { TablesInsert, TablesUpdate } from "../database.types";
import type { DbCondition } from "../types";
import { check, DbError, requireUserId, unwrap, type Sb } from "./helpers";

export type ConditionInput = Pick<TablesInsert<"conditions">, "name" | "diagnosed_on" | "notes">;
/** A patient edits these only: who diagnosed them (`source`, `diagnosed_by`) is not theirs to change. */
export type ConditionPatch = Pick<TablesUpdate<"conditions">, "name" | "diagnosed_on" | "notes" | "active">;

/** The key a condition's name is compared by: case and the spaces at the ends make no second condition (#333). */
const nameKey = (name: string) => name.trim().toLowerCase();

/** The database's "already there" (the unique index of migration 0020), in words a patient understands. */
const duplicateError = () => new DbError("You already have this condition on your list.", "23505");

export async function listConditions(sb: Sb): Promise<DbCondition[]> {
  const patientId = await requireUserId(sb);
  const rows = unwrap(await sb.from("conditions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }));
  // Defensive (#333): a database that has not had migration 0020 yet can still hold duplicate
  // rows (the live check left them). Every screen reads through here, so the list shows each
  // condition once — the oldest row of each name, the one the migration keeps.
  const oldest = new Map<string, DbCondition>();
  for (const row of rows) {
    const kept = oldest.get(nameKey(row.name));
    if (!kept || row.created_at < kept.created_at) oldest.set(nameKey(row.name), row);
  }
  return rows.filter((row) => oldest.get(nameKey(row.name))?.id === row.id);
}

/** A patient adds a condition themselves (source 'patient'). Conditions from a doctor's diagnosis are added by the server. */
export async function addCondition(sb: Sb, input: ConditionInput): Promise<DbCondition> {
  const patientId = await requireUserId(sb);
  const res = await sb.from("conditions").insert({ ...input, patient_id: patientId, source: "patient" }).select().single();
  if (res.error?.code === "23505") throw duplicateError();
  return unwrap(res);
}

export async function updateCondition(sb: Sb, id: string, patch: ConditionPatch): Promise<DbCondition> {
  const res = await sb.from("conditions").update(patch).eq("id", id).select().single();
  if (res.error?.code === "23505") throw duplicateError();
  return unwrap(res);
}

export async function deleteCondition(sb: Sb, id: string): Promise<void> {
  check(await sb.from("conditions").delete().eq("id", id));
}
