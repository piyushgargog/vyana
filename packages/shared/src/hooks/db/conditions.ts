"use client";

// packages/shared/src/hooks/db/conditions.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { addCondition, deleteCondition, listConditions, updateCondition, type ConditionInput, type ConditionPatch } from "../../db/queries/conditions";
import type { DbError } from "../../db/queries/helpers";
import type { DbCondition } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

export function useConditions() {
  const { sb, ready } = useDb();
  return useQuery<DbCondition[], DbError>({
    queryKey: [DB_KEYS.conditions],
    queryFn: () => listConditions(sb),
    enabled: ready,
  });
}

export function useAddCondition() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbCondition, DbError, ConditionInput>({
    mutationFn: (input) => addCondition(sb, input),
    onSuccess: () => invalidate(DB_KEYS.conditions, DB_KEYS.timeline),
  });
}

export function useUpdateCondition() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbCondition, DbError, { id: string; patch: ConditionPatch }>({
    mutationFn: ({ id, patch }) => updateCondition(sb, id, patch),
    onSuccess: () => invalidate(DB_KEYS.conditions, DB_KEYS.timeline),
  });
}

export function useDeleteCondition() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<void, DbError, string>({
    mutationFn: (id) => deleteCondition(sb, id),
    onSuccess: () => invalidate(DB_KEYS.conditions, DB_KEYS.timeline),
  });
}
