"use client";

// packages/shared/src/hooks/db/chat.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import { getChatMessages, listChatSessions } from "../../db/queries/chat";
import type { DbError } from "../../db/queries/helpers";
import type { DbChatMessage, DbChatSession } from "../../db/types";
import { DB_KEYS, useDb } from "./shared";

export function useChatSessions() {
  const { sb, ready } = useDb();
  return useQuery<DbChatSession[], DbError>({
    queryKey: [DB_KEYS.chatSessions],
    queryFn: () => listChatSessions(sb),
    enabled: ready,
  });
}

export function useChatMessages(sessionId: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbChatMessage[], DbError>({
    queryKey: [DB_KEYS.chatMessages, sessionId],
    queryFn: () => getChatMessages(sb, sessionId as string),
    enabled: ready && !!sessionId,
  });
}
