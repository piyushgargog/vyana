"use client";

// packages/shared/src/hooks/db/plans.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import { getCurrentPlan, listPlans, type CurrentPlan, type PlanRow } from "../../db/queries/plans";
import type { DbError } from "../../db/queries/helpers";
import { DB_KEYS, afterSession, useDb } from "./shared";

/** The signed-in user's plan and its limits (issue #301) — null while it loads or when signed out. */
export function useCurrentPlan() {
  const { sb, ready } = useDb();
  return useQuery<CurrentPlan | null, DbError>({
    queryKey: [DB_KEYS.plan],
    queryFn: () => getCurrentPlan(sb),
    enabled: ready,
  });
}

/**
 * Every plan in the catalogue with its limits (issue #418) — the list the plans
 * page shows. The plans table is public reading, so this runs signed out too.
 */
export function usePlans() {
  const { sb } = useDb();
  return useQuery<PlanRow[], DbError>({
    queryKey: [DB_KEYS.plan, "list"],
    queryFn: () => afterSession(sb, listPlans),
  });
}
