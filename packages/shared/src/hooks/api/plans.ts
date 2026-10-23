"use client";

// Waitlist hook (#305). The plan and AI-usage reads that were mock-first here
// now come from the database hooks (useCurrentPlan / usePlans /
// useMyAiUsageToday in hooks/db, issue #418); the waitlist join still goes
// through the API client.
import { useMutation } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type { JoinWaitlistReq, JoinWaitlistRes } from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

/** Join the Family waitlist once; a repeat join answers "already_on_list". */
export function useJoinWaitlistPage() {
  const api = useApi();
  return useMutation<JoinWaitlistRes, ApiError, JoinWaitlistReq>({
    mutationKey: [QUERY_ROOTS.plans, "waitlist", "join"],
    mutationFn: (body) => api.waitlist.join(body),
  });
}
