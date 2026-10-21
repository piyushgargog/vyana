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
  bloodRequests: "blood-requests",
  consent: "consent",
  timeline: "timeline",
} as const;

/** The Supabase client, the signed-in user's id, and whether queries may run (signed in and loaded). */
export function useDb(): { sb: Sb; userId: string | null; ready: boolean } {
  const sb = useSupabase();
  const { user, loading } = useSession();
  return { sb, userId: user?.id ?? null, ready: !loading && !!user };
}

/**
 * Runs a read only once the client's own session is attached (#223, #225). useDb's `ready`
 * follows the React session state, which settles at a different moment than the Supabase
 * client's token; a read that goes out in between reaches RLS without the user's JWT and
 * comes back as a successful EMPTY result, which the query cache then keeps. Awaiting
 * getSession() first makes the read carry the token or not run at all.
 */
export async function afterSession<T>(sb: Sb, run: (sb: Sb) => Promise<T>): Promise<T> {
  try {
    await sb.auth.getSession();
  } catch {
    // A failed session read must not block the query; the read itself will surface any real error.
  }
  return run(sb);
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
 * `removeChannel` is async: the old channel stays registered under its topic until the leave finishes, and asking for
 * the same topic again returns that leaving channel, which never delivers anything. So every channel gets its own topic
 * (a counter suffix), and the last hook's release is deferred by a tick so a hook that mounts straight after (React
 * StrictMode, a route change between two screens on the same table) reuses the open channel.
 */
let channelSeq = 0;

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
      const stop = subscribeTable(sb, `${name}:${++channelSeq}`, table, () => {
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
        setTimeout(() => {
          if (live.refs > 0 || sharedChannels.get(name) !== live) return;
          live.stop();
          sharedChannels.delete(name);
        }, 0);
      }
    };
  }, [sb, ready, userId, table, rootKey, invalidate]);
}
