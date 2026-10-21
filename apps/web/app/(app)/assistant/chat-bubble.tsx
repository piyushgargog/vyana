"use client";

import React, { memo } from "react";
import { ButtonLink, Pill, cn } from "@/components/ui";
import { AiSafetyBanner } from "@/components/ui-primitives";
import {
  extractLinksFromText,
  getMessageText,
  isEmergencyReplyText,
  stripMarkdownLinks,
  toolActivityLabel,
  type AssistantMessage,
} from "./chat-helpers";
import { FormattedMarkdown } from "./formatted-markdown";

/**
 * One chat bubble. `memo` keeps a streaming reply from re-rendering the bubbles before it.
 * Nothing here calls anyone by itself: `tel:108` is a plain link that opens only when it is tapped.
 */
export const ChatBubble = memo(function ChatBubble({ message }: { message: AssistantMessage }) {
  if (message.role !== "user" && message.role !== "assistant") return null;

  const text = getMessageText(message);

  if (message.role === "user") {
    return (
      <div
        aria-label={`You said: ${text}`}
        className="ml-auto max-w-[85%] rounded-card bg-accent px-4 py-3 text-white"
      >
        <p className="whitespace-pre-wrap text-[15px]">{text}</p>
      </div>
    );
  }

  const emergency = isEmergencyReplyText(text);
  const links = extractLinksFromText(text);
  const labels = message.parts
    .map((part) => toolActivityLabel(part.type))
    .filter((label, index, all): label is string => label !== null && label !== all[index - 1]);

  return (
    <div
      aria-label={`Vyana said: ${text}`}
      className={cn(
        "mr-auto max-w-[85%] space-y-3 rounded-card border px-4 py-3",
        emergency ? "border-danger bg-danger-soft" : "border-separator bg-surface"
      )}
    >
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labels.map((label, index) => (
            <Pill key={`tool-${index}`} tone="neutral">
              {label}
            </Pill>
          ))}
        </div>
      )}

      {text.length > 0 && (
        <FormattedMarkdown text={stripMarkdownLinks(text)} />
      )}

      {emergency && (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="tel:108" variant="destructive" size="md">
            Call 108 now
          </ButtonLink>
          <ButtonLink href="/sos" variant="secondary" size="md">
            Open emergency help
          </ButtonLink>
        </div>
      )}

      {links.length > 0 && (
        <div className="space-y-2">
          <p className="text-[15px] text-label-3">Sources</p>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-full bg-accent-soft px-3 py-1.5 text-[15px] font-medium text-accent-strong"
              >
                {link.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {text.length > 0 && <AiSafetyBanner feature="assistant_chat" aiRunId={message.metadata?.ai_run_id} />}
    </div>
  );
});
