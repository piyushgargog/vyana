"use client";

// packages/shared/src/hooks/db/waitlist.ts
// Owner: Vaibhav Parmar

import { useMutation } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { joinWaitlist, type WaitlistEntry } from "../../db/queries/waitlist";
import { useDb } from "./shared";

/** Join a plan's waitlist from the pricing page (issue #301). Works signed out too: the database function is the gate. */
export function useJoinWaitlist() {
  const { sb } = useDb();
  return useMutation<WaitlistEntry, DbError, { email: string; plan_id: string; note?: string }>({
    mutationFn: ({ email, plan_id, note }) => joinWaitlist(sb, email, plan_id, note),
  });
}
