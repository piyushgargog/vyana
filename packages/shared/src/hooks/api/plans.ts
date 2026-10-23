"use client";

// Plan, waitlist and AI-usage hooks (#305, mock-first). Names follow the issue (M1/M2): when
// Vaibhav's hooks land on the real plans table, these are the surface the screens already use.
//
// #418: Vaibhav's hooks have landed, so the screens now read the real plan and the real
// count through the DB hooks (`useCurrentPlan`, `useMyAiUsageToday` in hooks/db). These
// API hooks remain the surface for the waitlist and for mock mode; `useRefreshAiUsage`
// below refreshes both query families so the assistant chip stays current.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import { DB_KEYS } from "../db/shared";
import type {
  AiUsageTodayRes,
  JoinWaitlistReq,
  JoinWaitlistRes,
  PlansRes,
} from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

/** The plans and which one the signed-in user is on. */
export function useCurrentPlanPage() {
  const api = useApi();
  return useQuery<PlansRes, ApiError>({
    queryKey: [QUERY_ROOTS.plans, "current"],
    queryFn: () => api.plans.current(),
  });
}

/** Join the Family waitlist once; a repeat join answers "already_on_list". */
export function useJoinWaitlistPage() {
  const api = useApi();
  return useMutation<JoinWaitlistRes, ApiError, JoinWaitlistReq>({
    mutationKey: [QUERY_ROOTS.plans, "waitlist", "join"],
    mutationFn: (body) => api.waitlist.join(body),
  });
}

/** AI answers used today against the plan's daily limit, and when the count resets.
 *  (The DB hook named `useMyAiUsageToday` in hooks/db reads the cost totals from
 *  #313 instead — calls and tokens, without a limit.) */
export function usePlanAiUsageToday() {
  const api = useApi();
  return useQuery<AiUsageTodayRes, ApiError>({
    queryKey: [QUERY_ROOTS.planAiUsage, "today"],
    queryFn: () => api.aiUsage.today(),
  });
}

/** A callback that re-reads today's AI usage — called when an answer finishes, so the
 *  "N left today" chip updates at once instead of on the next reload. The chip reads the
 *  DB hook since #418, so both the API root and the DB key are invalidated. */
export function useRefreshAiUsage() {
  const qc = useQueryClient();
  return useCallback(() => {
    void qc.invalidateQueries({ queryKey: [QUERY_ROOTS.planAiUsage] });
    void qc.invalidateQueries({ queryKey: [DB_KEYS.aiUsage] });
  }, [qc]);
}
