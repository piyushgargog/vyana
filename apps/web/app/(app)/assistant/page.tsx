"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useApi, useChatMessages, useChatSessions, useRefreshChatHistory } from "@vyana/shared";
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  LargeTitle,
  Pill,
  SkeletonLine,
} from "@/components/ui";
import { Loader2, MessageCircleQuestion } from "lucide-react";
import { ChatBubble } from "./chat-bubble";
import type { AssistantMessage } from "./chat-helpers";

export default function AssistantPage() {
  const api = useApi();
  const { data: sessions = [], isLoading: sessionsLoading } =
    useChatSessions();

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const hydratedSessionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!sessionId && sessions.length > 0 && !hydratedSessionRef.current) {
      setSessionId(sessions[0].id);
    }
  }, [sessions, sessionId]);

  const { data: savedMessages, isLoading: historyLoading } =
    useChatMessages(sessionId);

  // The live messages are newer than the saved ones (the reply is saved when the stream ends), so a session created by
  // this chat must not be hydrated from the database over them.
  const [startedHere, setStartedHere] = useState<string | undefined>(undefined);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantMessage>({
        api: api.chatUrl,
        headers: () => api.authHeaders(),
        body: sessionId ? { session_id: sessionId } : {},
        fetch: async (input, init) => {
          const res = await fetch(input, init);
          const next = res.headers.get("x-session-id");
          if (next && next !== sessionId) {
            setStartedHere(next);
            setSessionId(next);
          }
          return res;
        },
      }),
    [api, sessionId]
  );

  const { messages, setMessages, sendMessage, status, error, clearError } =
    useChat<AssistantMessage>({ transport });
  useRefreshChatHistory(status);

  useEffect(() => {
    if (
      sessionId &&
      savedMessages &&
      hydratedSessionRef.current !== sessionId &&
      startedHere !== sessionId &&
      status === "ready"
    ) {
      hydratedSessionRef.current = sessionId;
      const mapped: AssistantMessage[] = savedMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: Array.isArray(m.parts)
            ? (m.parts as unknown as AssistantMessage["parts"])
            : [{ type: "text" as const, text: String(m.parts ?? "") }],
        }));
      setMessages(mapped);
    }
  }, [sessionId, savedMessages, setMessages, status, startedHere]);

  const [input, setInput] = useState("");
  const isStreaming = status === "submitted" || status === "streaming";

  const newChat = useCallback(() => {
    hydratedSessionRef.current = "new";
    setSessionId(undefined);
    setStartedHere(undefined);
    clearError();
    setMessages([]);
  }, [clearError, setMessages]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || isStreaming) return;
      setInput("");
      clearError();
      await sendMessage({ text });
    },
    [input, isStreaming, clearError, sendMessage]
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const loadingHistory =
    sessionsLoading || (sessionId !== undefined && historyLoading);
  const waitingForAnswer =
    status === "submitted" &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LargeTitle
        title="Ask Vyana"
        subtitle="Answers are for information only. Vyana never diagnoses and never prescribes medication."
        actions={
          <Button variant="secondary" size="sm" onClick={newChat}>
            New chat
          </Button>
        }
      />

      {loadingHistory ? (
        <div className="space-y-3" aria-label="Loading your past messages">
          <SkeletonLine className="w-2/3" />
          <SkeletonLine />
          <SkeletonLine className="w-1/2" />
        </div>
      ) : (
        <>
          {messages.length === 0 ? (
            <EmptyState
              icon={<MessageCircleQuestion aria-hidden="true" />}
              title="Ask about your health"
              body="Ask about your medicines, lab values or symptoms. Answers come from trusted sources, with links."
            />
          ) : (
            <div className="min-h-[40vh] space-y-4">
              {messages.map((m) => (
                <ChatBubble key={m.id} message={m} />
              ))}
              {waitingForAnswer && (
                <Pill tone="neutral">Searching trusted sources…</Pill>
              )}
              <div ref={bottomRef} aria-hidden="true" />
            </div>
          )}

          {error && (
            <ErrorState
              title="Could not get an answer"
              body={error.message}
              onRetry={() => clearError()}
              retryLabel="Try again"
            />
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className="sticky bottom-0 bg-canvas pt-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field
              label="Your question"
              placeholder="For example: what does my HbA1c result mean?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={input.trim().length === 0 || isStreaming}
            icon={
              isStreaming ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : undefined
            }
            className="min-h-[44px] shrink-0"
          >
            Ask
          </Button>
        </div>
      </form>
    </div>
  );
}
