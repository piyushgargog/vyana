"use client";

// Waitlist hook (#305, #418). The plan and AI-usage reads moved to the database
// hooks in hooks/db; the join follows them too — the API route it used to call
// (POST /api/waitlist) was never built, so a production submit 404d. The
// database function is the gate and works signed out (#301).
import { useMutation } from "@tanstack/react-query";

import type { JoinWaitlistReq, JoinWaitlistRes } from "../../contracts";
import type { DbError } from "../../db/queries/helpers";
import { useJoinWaitlist } from "../db/waitlist";
import { QUERY_ROOTS } from "./query-roots";

/** Join the Family waitlist once; a repeat join answers "already_on_list". */
export function useJoinWaitlistPage() {
  const join = useJoinWaitlist();
  return useMutation<JoinWaitlistRes, DbError, JoinWaitlistReq>({
    mutationKey: [QUERY_ROOTS.plans, "waitlist", "join"],
    mutationFn: async ({ email, note }) => ({
      status: (await join.mutateAsync({ email, plan_id: "family", note }))
        ? "joined"
        : "already_on_list",
    }),
  });
}
