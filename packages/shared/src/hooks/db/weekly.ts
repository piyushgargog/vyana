"use client";

// packages/shared/src/hooks/db/weekly.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import { getWeeklySummary } from "../../db/queries/weekly";
import type { DbError } from "../../db/queries/helpers";
import type { DbWeeklySummary } from "../../db/types";
import { DB_KEYS, useDb } from "./shared";

/** One patient's weekly summary for the week starting on `weekStart` (a Monday, `YYYY-MM-DD`). */
export function useWeeklySummary(patientId: string, weekStart: string) {
  const { sb, ready } = useDb();
  return useQuery<DbWeeklySummary | null, DbError>({
    queryKey: [DB_KEYS.weeklySummaries, patientId, weekStart],
    queryFn: () => getWeeklySummary(sb, patientId, weekStart),
    enabled: ready && patientId.length > 0,
  });
}
