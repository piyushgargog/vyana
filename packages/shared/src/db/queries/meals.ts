// packages/shared/src/db/queries/meals.ts
// Meal log (T3). The nutrition plan was replaced by care plans in v2 (see carePlans.ts).
// Owner: Vaibhav Parmar

import type { DbMealLog } from "../types";
import { requireUserId, startOfLocalDay, startOfNextLocalDay, unwrap, type Sb } from "./helpers";

export type AddMealInput = {
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories?: number | null;
  logged_at?: string;
};

/** The meals logged on one local day (`YYYY-MM-DD`), earliest first. */
export async function listMeals(sb: Sb, date: string): Promise<DbMealLog[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("meal_logs").select("*").eq("patient_id", patientId).gte("logged_at", startOfLocalDay(date)).lt("logged_at", startOfNextLocalDay(date)).order("logged_at")
  );
}

export async function addMeal(sb: Sb, input: AddMealInput): Promise<DbMealLog> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("meal_logs")
      .insert({
        patient_id: patientId,
        meal: input.meal,
        description: input.description,
        calories: input.calories ?? null,
        ...(input.logged_at ? { logged_at: input.logged_at } : {}),
      })
      .select()
      .single()
  );
}
