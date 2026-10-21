"use client";

// Plan, waitlist and AI-usage hooks (#305, mock-first). Names follow the issue (M1/M2): when
// Vaibhav's hooks land on the real plans table, these are the surface the screens already use.
import { useMutation, useQuery } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type {
  AiUsageTodayRes,
  JoinWaitlistReq,
  JoinWaitlistRes,
  PlansRes,
} from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

/** The plans and which one the signed-in user is on. */
export function useCurrentPlan() {
  const api = useApi();
  return useQuery<PlansRes, ApiError>({
    queryKey: [QUERY_ROOTS.plans, "current"],
    queryFn: () => api.plans.current(),
  });
}

/** Join the Family waitlist once; a repeat join answers "already_on_list". */
export function useJoinWaitlist() {
  const api = useApi();
  return useMutation<JoinWaitlistRes, ApiError, JoinWaitlistReq>({
    mutationKey: [QUERY_ROOTS.plans, "waitlist", "join"],
    mutationFn: (body) => api.waitlist.join(body),
  });
}

/** AI answers used today, the plan's daily limit, and when the count resets. */
export function useMyAiUsageToday() {
  const api = useApi();
  return useQuery<AiUsageTodayRes, ApiError>({
    queryKey: [QUERY_ROOTS.aiUsage, "today"],
    queryFn: () => api.aiUsage.today(),
  });
}
