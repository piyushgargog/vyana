// packages/shared/src/db/queries/meals.ts
// Meal log (T3). The nutrition plan was replaced by care plans in v2 (see carePlans.ts).
// Owner: Vaibhav Parmar

import { MEAL_CALORIES_MAX, MEAL_DESCRIPTION_MAX, MEAL_TYPES, type MealType } from "../../constants";
import type { DbMealLog } from "../types";
import { check, DbError, requireUserId, startOfLocalDay, startOfNextLocalDay, unwrap, type Sb } from "./helpers";

export type AddMealInput = {
  meal: MealType;
  description: string;
  /** Whole calories, 0 to `MEAL_CALORIES_MAX`; leave out when unknown. */
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

/** Checks a meal before it is sent, so the user gets a clear message instead of a constraint error. Returns the cleaned description. */
function validateMeal(input: AddMealInput): string {
  if (!MEAL_TYPES.includes(input.meal)) throw new DbError("Pick breakfast, lunch, dinner or snack", "invalid_meal");
  const description = input.description.trim();
  if (description.length === 0) throw new DbError("Say what you ate", "invalid_meal");
  if (description.length > MEAL_DESCRIPTION_MAX) throw new DbError(`Keep it under ${MEAL_DESCRIPTION_MAX} characters`, "invalid_meal");
  const calories = input.calories;
  if (calories !== null && calories !== undefined && (!Number.isInteger(calories) || calories < 0 || calories > MEAL_CALORIES_MAX)) {
    throw new DbError(`Calories must be a whole number from 0 to ${MEAL_CALORIES_MAX}`, "invalid_meal");
  }
  if (input.logged_at !== undefined && Number.isNaN(new Date(input.logged_at).getTime())) throw new DbError("That time is not valid", "invalid_meal");
  return description;
}

export async function addMeal(sb: Sb, input: AddMealInput): Promise<DbMealLog> {
  const description = validateMeal(input);
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("meal_logs")
      .insert({
        patient_id: patientId,
        meal: input.meal,
        description,
        calories: input.calories ?? null,
        ...(input.logged_at ? { logged_at: input.logged_at } : {}),
      })
      .select()
      .single()
  );
}

/** Removes one of the signed-in patient's own meals (a wrong entry). Another patient's id deletes nothing. */
export async function deleteMeal(sb: Sb, id: string): Promise<void> {
  const patientId = await requireUserId(sb);
  check(await sb.from("meal_logs").delete().eq("id", id).eq("patient_id", patientId));
}

/** The calories of a day's meals; meals without a number count as 0, `known` is how many had one. */
export function totalCalories(meals: Pick<DbMealLog, "calories">[]): { total: number; known: number; unknown: number } {
  let total = 0;
  let known = 0;
  for (const m of meals) {
    if (typeof m.calories === "number") {
      total += m.calories;
      known++;
    }
  }
  return { total, known, unknown: meals.length - known };
}
