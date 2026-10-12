"use client";

// packages/shared/src/hooks/db/shared.ts
// Plumbing for the DB hooks: the client, the signed-in user and query keys. Owner: Vaibhav Parmar

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { Sb } from "../../db/queries/helpers";
import { useSession, useSupabase } from "../../providers/AppProviders";

/**
 * Keys that no API hook invalidates. The ones the API hooks refresh come from QUERY_ROOTS
 * (hooks/api/query-roots.ts) and every key starts with its root, e.g. [QUERY_ROOTS.prescriptions, ...].
 */
export const DB_KEYS = {
  profile: "profile",
  myDoctor: "my-doctor",
  contacts: "emergency-contacts",
  conditions: "conditions",
  doseLogs: "dose-logs",
  adherence: "adherence",
  vitals: "vitals",
  meals: "meals",
  chatSessions: "chat-sessions",
  chatMessages: "chat-messages",
  consent: "consent",
  timeline: "timeline",
} as const;

/** The Supabase client, the signed-in user's id, and whether queries may run (signed in and loaded). */
export function useDb(): { sb: Sb; userId: string | null; ready: boolean } {
  const sb = useSupabase();
  const { user, loading } = useSession();
  return { sb, userId: user?.id ?? null, ready: !loading && !!user };
}

/** `invalidate(root1, root2, ...)` refreshes every query whose key starts with one of the roots. */
export function useInvalidate(): (...roots: string[]) => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(
    async (...roots: string[]) => {
      await Promise.all(roots.map((root) => queryClient.invalidateQueries({ queryKey: [root] })));
    },
    [queryClient]
  );
}
