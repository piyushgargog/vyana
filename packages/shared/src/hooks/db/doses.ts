"use client";

// packages/shared/src/hooks/db/doses.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { getAdherence, listDoseLogs, logDose, undoDose, type Adherence, type LogDoseInput } from "../../db/queries/doses";
import type { DbError } from "../../db/queries/helpers";
import type { DbDoseLog } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

export function useLogDose() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbDoseLog, DbError, LogDoseInput>({
    mutationFn: (input) => logDose(sb, input),
    onSuccess: () => invalidate(DB_KEYS.doseLogs, DB_KEYS.adherence),
  });
}

/** Undoes a dose the patient logged (taken or skipped); a missed row is never removed. */
export function useUndoDose() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<void, DbError, { item_id: string; scheduled_for: string }>({
    mutationFn: (input) => undoDose(sb, input),
    onSuccess: () => invalidate(DB_KEYS.doseLogs, DB_KEYS.adherence),
  });
}

/** Dose logs due between `from` and `to` (ISO timestamps, `to` excluded). */
export function useDoseLogs(from: string, to: string) {
  const { sb, ready } = useDb();
  return useQuery<DbDoseLog[], DbError>({
    queryKey: [DB_KEYS.doseLogs, from, to],
    queryFn: () => listDoseLogs(sb, from, to),
    enabled: ready,
  });
}

/** Share of doses taken over the last `days` days. */
export function useAdherence(days: number) {
  const { sb, ready } = useDb();
  return useQuery<Adherence, DbError>({
    queryKey: [DB_KEYS.adherence, days],
    queryFn: () => getAdherence(sb, days),
    enabled: ready,
  });
}
