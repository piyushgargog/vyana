"use client";

// packages/shared/src/hooks/db/waitlist.ts
// Owner: Vaibhav Parmar

import { useMutation } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { joinWaitlist } from "../../db/queries/waitlist";
import { useDb } from "./shared";

/** Join a plan's waitlist from the pricing page (issue #301). Works signed out too: the database function is the gate.
 *  Resolves true when the address is new to the plan, false when it was already on the list. */
export function useJoinWaitlist() {
  const { sb } = useDb();
  return useMutation<boolean, DbError, { email: string; plan_id: string; note?: string }>({
    mutationFn: ({ email, plan_id, note }) => joinWaitlist(sb, email, plan_id, note),
  });
}
