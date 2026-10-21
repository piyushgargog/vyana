"use client";

// packages/shared/src/hooks/db/plans.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import { getCurrentPlan, type CurrentPlan } from "../../db/queries/plans";
import type { DbError } from "../../db/queries/helpers";
import { DB_KEYS, useDb } from "./shared";

/** The signed-in user's plan and its limits (issue #301) — null while it loads or when signed out. */
export function useCurrentPlan() {
  const { sb, ready } = useDb();
  return useQuery<CurrentPlan | null, DbError>({
    queryKey: [DB_KEYS.plan],
    queryFn: () => getCurrentPlan(sb),
    enabled: ready,
  });
}
