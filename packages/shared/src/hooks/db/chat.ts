"use client";

// packages/shared/src/hooks/db/chat.ts
// Owner: Vaibhav Parmar

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getChatMessages, listChatSessions } from "../../db/queries/chat";
import type { DbError } from "../../db/queries/helpers";
import type { DbChatMessage, DbChatSession } from "../../db/types";
import { DB_KEYS, useDb } from "./shared";

const HISTORY_STALE_MS = 10_000;

export function useChatSessions() {
  const { sb, ready } = useDb();
  return useQuery<DbChatSession[], DbError>({
    queryKey: [DB_KEYS.chatSessions],
    queryFn: () => listChatSessions(sb),
    enabled: ready,
    // A chat started on the other device must show up: read again when the screen opens (the app default keeps data fresh for 5 minutes).
    staleTime: HISTORY_STALE_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useChatMessages(sessionId: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbChatMessage[], DbError>({
    queryKey: [DB_KEYS.chatMessages, sessionId],
    queryFn: () => getChatMessages(sb, sessionId as string),
    enabled: ready && !!sessionId,
    staleTime: HISTORY_STALE_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

/**
 * Call it with the `status` of `useChat`: when a reply has ended (the server saves it at that moment) the saved history is read again,
 * so the new chat is in the list and the other device sees the reply. The messages on screen are not replaced.
 */
export function useRefreshChatHistory(status: string): void {
  const queryClient = useQueryClient();
  const wasBusy = useRef(false);
  useEffect(() => {
    const busy = status === "submitted" || status === "streaming";
    if (wasBusy.current && !busy) {
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.chatSessions] });
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.chatMessages] });
    }
    wasBusy.current = busy;
  }, [status, queryClient]);
}
