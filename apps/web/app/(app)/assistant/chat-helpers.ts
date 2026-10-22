import type { UIMessage } from "ai";

/** A chat message of the assistant; the server puts the id of the AI run into its metadata. */
export type AssistantMessage = UIMessage<{ ai_run_id?: string }>;

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** The text of a message: its text parts, joined. */
export function getMessageText(message: AssistantMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/** Markdown links `[title](https://…)` in the text: only http and https, the first title wins for a repeated URL. */
export function extractLinksFromText(text: string): { title: string; url: string }[] {
  const found: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(MARKDOWN_LINK_RE)) {
    const title = match[1]?.trim();
    const url = match[2]?.trim();
    if (title && url && !seen.has(url)) {
      seen.add(url);
      found.push({ title, url });
    }
  }
  return found;
}

/** The text with every `[title](url)` replaced by just `title` (the links are shown as chips). */
export function stripMarkdownLinks(text: string): string {
  return text.replace(MARKDOWN_LINK_RE, "$1");
}

/** True when an assistant reply is the emergency notice: it tells the person to call 108. */
export function isEmergencyReplyText(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.startsWith("if this is an emergency") ||
    normalized.includes("call 108") ||
    normalized.includes("108 पर कॉल") ||
    normalized.includes("108 par call")
  );
}

/** The label to show for a tool part of an assistant message, or null when the part is not shown. */
export function toolActivityLabel(partType: string): string | null {
  if (partType === "tool-search_health_web" || partType === "tool-read_page") return "Searching trusted sources…";
  if (partType === "tool-medicine_price_links") return "Preparing pharmacy links…";
  return null;
}
