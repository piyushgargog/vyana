// packages/shared/src/db/queries/chat.ts
// Owner: Vaibhav Parmar

import type { DbChatMessage, DbChatSession } from "../types";
import { requireUserId, unwrap, type Sb } from "./helpers";

/** The signed-in user's assistant conversations, newest first. */
export async function listChatSessions(sb: Sb): Promise<DbChatSession[]> {
  const userId = await requireUserId(sb);
  return unwrap(await sb.from("chat_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }));
}

/** The messages of one conversation, oldest first. */
export async function getChatMessages(sb: Sb, sessionId: string): Promise<DbChatMessage[]> {
  return unwrap(await sb.from("chat_messages").select("*").eq("session_id", sessionId).order("created_at"));
}
