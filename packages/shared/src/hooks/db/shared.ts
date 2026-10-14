"use client";

// packages/shared/src/hooks/db/shared.ts
// Plumbing for the DB hooks: the client, the signed-in user and query keys. Owner: Vaibhav Parmar

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import type { Sb } from "../../db/queries/helpers";
import { liveChannelName, subscribeTable, type LiveTable } from "../../db/queries/realtime";
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

/**
 * One shared Realtime channel per (table, user). `useLiveInvalidate` used to open a new channel on
 * every hook call, so N hooks on the same table meant N connections and N refetch storms (notably on
 * the dashboard). Now the first hook opens the channel and the last one to unmount closes it; every
 * hook just registers its own invalidate callback (ref counted at module level).
 */
const sharedChannels = new Map<string, { stop: () => void; refs: number; callbacks: Set<() => void> }>();

/**
 * Refreshes the queries under `roots` whenever `table` changes for this user (Realtime applies RLS, so
 * a patient is told about their own rows only).
 */
export function useLiveInvalidate(table: LiveTable, ...roots: string[]): void {
  const { sb, userId, ready } = useDb();
  const invalidate = useInvalidate();
  const rootKey = roots.join("|");
  useEffect(() => {
    if (!ready || !userId) return;
    const name = liveChannelName(table, userId);
    const onChange = () => void invalidate(...rootKey.split("|"));
    let entry = sharedChannels.get(name);
    if (!entry) {
      const callbacks = new Set<() => void>();
      const stop = subscribeTable(sb, name, table, () => {
        for (const cb of callbacks) cb();
      });
      entry = { stop, refs: 0, callbacks };
      sharedChannels.set(name, entry);
    }
    entry.callbacks.add(onChange);
    entry.refs += 1;
    return () => {
      const live = sharedChannels.get(name);
      if (!live) return;
      live.callbacks.delete(onChange);
      live.refs -= 1;
      if (live.refs <= 0) {
        live.stop();
        sharedChannels.delete(name);
      }
    };
  }, [sb, ready, userId, table, rootKey, invalidate]);
}
