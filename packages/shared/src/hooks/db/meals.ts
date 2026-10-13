"use client";

// packages/shared/src/hooks/db/meals.ts
// Meal log (T3). The nutrition plan hook was removed in v2: use useCarePlan. Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { addMeal, deleteMeal, listMeals, type AddMealInput } from "../../db/queries/meals";
import type { DbMealLog } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

/** The meals logged on one day (`YYYY-MM-DD`). */
export function useMeals(date: string) {
  const { sb, ready } = useDb();
  return useQuery<DbMealLog[], DbError>({
    queryKey: [DB_KEYS.meals, date],
    queryFn: () => listMeals(sb, date),
    enabled: ready,
  });
}

export function useAddMeal() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbMealLog, DbError, AddMealInput>({
    mutationFn: (input) => addMeal(sb, input),
    onSuccess: () => invalidate(DB_KEYS.meals),
  });
}

export function useDeleteMeal() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<void, DbError, string>({
    mutationFn: (id) => deleteMeal(sb, id),
    onSuccess: () => invalidate(DB_KEYS.meals),
  });
}
