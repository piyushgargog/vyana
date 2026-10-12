"use client";

// packages/shared/src/hooks/db/vitals.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import type { VitalType } from "../../constants";
import type { DbError } from "../../db/queries/helpers";
import { addVital, listVitals, type AddVitalInput } from "../../db/queries/vitals";
import type { DbVital } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

/** Readings of one type from the last `days` days. */
export function useVitals(type: VitalType, days: number) {
  const { sb, ready } = useDb();
  return useQuery<DbVital[], DbError>({
    queryKey: [DB_KEYS.vitals, type, days],
    queryFn: () => listVitals(sb, type, days),
    enabled: ready,
  });
}

export function useAddVital() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbVital, DbError, AddVitalInput>({
    mutationFn: (input) => addVital(sb, input),
    onSuccess: () => invalidate(DB_KEYS.vitals),
  });
}
