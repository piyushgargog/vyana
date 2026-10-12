"use client";

// packages/shared/src/hooks/db/timeline.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { getTimeline, type TimelineEntry } from "../../db/queries/timeline";
import { DB_KEYS, useDb } from "./shared";

/**
 * Prescriptions, reports, appointments and conditions merged by date. It reads from four tables that
 * several hooks change, so it is always refetched when a screen opens (no stale time).
 */
export function useTimeline(patientId?: string) {
  const { sb, ready } = useDb();
  return useQuery<TimelineEntry[], DbError>({
    queryKey: [DB_KEYS.timeline, patientId ?? "me"],
    queryFn: () => getTimeline(sb, patientId),
    enabled: ready,
    staleTime: 0,
  });
}
