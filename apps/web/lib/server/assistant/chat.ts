import "server-only";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type ModelMessage,
  type UIMessageChunk,
} from "ai";
import { z } from "zod";
import { Language } from "@vyana/shared";
import { finishAiRun, startAiRun } from "../ai";
import type { AuthedUser } from "../auth";
import { badRequest, notFound } from "../errors";
import { getModel, isLlmMock } from "../llm";
import { log } from "../log";
import { findDosePatterns } from "../safety/blocklists";
import { matchRedFlags } from "../safety/red-flags";
import { redact } from "../safety/redact";
import { ReplyGuard } from "./guard";
import { scriptedAssistantModel } from "./mock-model";
import { ASSISTANT_PROMPT_VERSION, EMERGENCY_NOTICE, assistantSystemPrompt } from "./system-prompt";
import { assistantTools } from "./tools";

/** The assistant chat (SPEC §11, PLAN §6.4, ADR-043). */

const HISTORY = 20;
const MAX_TEXT = 4_000;
/**
 * The history sent to the model is cut to this many characters (about 1,500 tokens), newest turns first. Patient data may
 * only go to Groq, whose free tier refuses a request over 8,000 tokens (413) and a tool loop sends the history again at
 * every step, so a long chat would otherwise fail on every key.
 */
const HISTORY_CHARS = 6_000;
/** Separates messages while the whole history is redacted in one pass (one placeholder per person). */
const SEPARATOR = "\n\n␞\n\n";
/** The question asks how much or how often to take a medicine, or whether to change it (ADR-065). */
export const isDoseQuestion = (q: string): boolean =>
  findDosePatterns(q).length > 0 ||
  /\b(?:how (?:much|many)|what dose|dosage|dose|double|skip|stop taking|halve|increase|reduce|take (?:\d|two|three|half)|instead of \d|kitn[aie]|badha|kam kar|chhod)\b|कितनी|कितना|खुराक/iu.test(q);

const SAFE_ERROR = "The answer could not be finished. Please try again.";

export const ChatBody = z.object({
  session_id: z.guid().optional(),
  messages: z
    .array(z.object({ role: z.string(), parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()) }).loose())
    .min(1)
    .max(100),
});
export type ChatBody = z.infer<typeof ChatBody>;

type Turn = { role: "user" | "assistant"; text: string };

/** Only the text of the last 20 user/assistant messages; tool, file and data parts from the client are ignored. */
export function historyFrom(messages: ChatBody["messages"]): Turn[] {
  const turns = messages
    .filter((m): m is typeof m & { role: Turn["role"] } => m.role === "user" || m.role === "assistant")
    .slice(-HISTORY)
    .map((m) => ({ role: m.role, text: m.parts.filter((p) => p.type === "text").map((p) => p.text ?? "").join("").trim() }))
    .filter((t) => t.text.length > 0);
  const last = turns.at(-1);
  if (!last || last.role !== "user" || messages.at(-1)?.role !== "user") throw badRequest("The last message must be a question from the user.");
  if (turns.some((t) => t.text.length > MAX_TEXT)) throw badRequest(`A message can be at most ${MAX_TEXT} characters.`);
  return fitHistory(turns);
}

/** The newest turns that fit `HISTORY_CHARS` (the last question is always kept); a history that had to be cut starts with a user turn again. */
export function fitHistory(turns: Turn[]): Turn[] {
  let total = 0;
  const kept: Turn[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    total += turns[i].text.length;
    if (kept.length > 0 && total > HISTORY_CHARS) break;
    kept.unshift(turns[i]);
  }
  if (kept.length < turns.length) while (kept.length > 1 && kept[0].role !== "user") kept.shift(); // only a cut history needs a new start
  return kept;
}

/** Redacts the whole history at once (rule 9). Falls back to the last message alone if the split doesn't line up. */
function redactHistory(turns: Turn[], knownNames: string[]): { messages: ModelMessage[]; placeholders: Record<string, string> } {
  const all = redact(turns.map((t) => t.text).join(SEPARATOR), { knownNames });
  const texts = all.text.split(SEPARATOR);
  if (texts.length === turns.length) {
    return { messages: turns.map((t, i) => ({ role: t.role, content: texts[i] })), placeholders: all.map };
  }
  const last = redact(turns[turns.length - 1].text, { knownNames });
  return { messages: [{ role: "user", content: last.text }], placeholders: last.map };
}

function chatModel(): LanguageModel {
  return isLlmMock() ? scriptedAssistantModel() : getModel("text");
}

async function openSession({ sb, user }: AuthedUser, sessionId: string | undefined, firstText: string): Promise<string> {
  if (sessionId) {
    const { data, error } = await sb.from("chat_sessions").select("id").eq("id", sessionId).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound("This conversation was not found.");
    return sessionId;
  }
  const { data, error } = await sb.from("chat_sessions").insert({ user_id: user.id, title: firstText.slice(0, 60) }).select("id").single();
  if (error || !data) throw error ?? new Error("chat session not created");
  return (data as { id: string }).id;
}

export async function assistantChat(authed: AuthedUser, body: ChatBody): Promise<Response> {
  const { sb, user, profile } = authed;
  const turns = historyFrom(body.messages);
  const question = turns[turns.length - 1].text;
  const language = Language.catch("en").parse(profile.preferred_language);

  const sessionId = await openSession(authed, body.session_id, question);
  const { error: saveError } = await sb
    .from("chat_messages")
    .insert({ session_id: sessionId, user_id: user.id, role: "user", parts: [{ type: "text", text: question }] });
  if (saveError) throw saveError;

  const emergency = matchRedFlags(question).length > 0;
  const { messages, placeholders } = redactHistory(turns, profile.full_name ? [profile.full_name] : []);
  const guard = new ReplyGuard({ language, placeholders, doseQuestion: isDoseQuestion(question) });
  // The reply streams after the route has logged its line, so TinyFish calls are counted and logged here.
  const counter = { tinyfishCalls: 0 };
  const runId = await startAiRun(
    { feature: "assistant_chat", userId: user.id, promptVersion: ASSISTANT_PROMPT_VERSION, inputRef: `chat_sessions/${sessionId}`, sources: [] },
    "text",
  );

  // Only a stream error fails the reply. A bad tool call is reported to the model, which carries on.
  let failed = false;
  const errorText = (err: unknown) => {
    log({ event: "assistant_stream_error", error: err instanceof Error ? err.name : "Error" });
    return SAFE_ERROR;
  };
  const onError = (err: unknown) => {
    failed = true;
    return errorText(err);
  };

  const writeText = (writer: { write: (chunk: UIMessageChunk) => void }, id: string, text: string) => {
    writer.write({ type: "text-start", id });
    writer.write({ type: "text-delta", id, delta: text });
    writer.write({ type: "text-end", id });
  };

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageMetadata: { ai_run_id: runId } });
      // Written by the server before the model runs, so it is always first (§2A rule 4).
      if (emergency) writeText(writer, "emergency-notice", EMERGENCY_NOTICE[language]);
      const result = streamText({
        model: chatModel(),
        instructions: assistantSystemPrompt(language, { emergency }),
        messages,
        tools: assistantTools({ userId: user.id, sb, guard, counter }),
        stopWhen: isStepCount(5),
        temperature: 0,
        experimental_transform: guard.transform(),
      });
      // Copied chunk by chunk (not merged) so the notes can follow the model's last chunk and come before "finish".
      const reader = toUIMessageStream({ stream: result.stream, sendStart: false, sendFinish: false, onError: errorText }).getReader();
      for (let next = await reader.read(); !next.done; next = await reader.read()) {
        if (next.value.type === "error") {
          failed = true;
          // Shown as text too, so the patient never sees an empty answer (P24).
          writeText(writer, "vyana-error", SAFE_ERROR);
        }
        writer.write(next.value);
      }
      if (failed) return;
      const note = guard.closingNotes();
      if (note) writeText(writer, "vyana-note", note);
      writer.write({ type: "finish" });
    },
    onError,
    onEnd: async ({ responseMessage, isAborted }) => {
      const status = failed || isAborted ? "rejected" : guard.needsReview ? "needs_review" : "ok";
      await finishAiRun(runId, {
        output: { text: guard.text, notes: guard.notes, removed_urls: guard.removed, emergency_notice: emergency },
        sources: guard.sources,
        status,
      });
      log({ event: "assistant_reply", status, tinyfish_calls: counter.tinyfishCalls, links: guard.sources.length, removed: guard.removed.length });
      if (failed || isAborted) return; // nothing half-written is saved
      const { error } = await sb
        .from("chat_messages")
        .insert({ session_id: sessionId, user_id: user.id, role: "assistant", parts: responseMessage.parts });
      if (error) log({ event: "assistant_save_failed" });
    },
  });

  return createUIMessageStreamResponse({ stream, headers: { "x-session-id": sessionId } });
}
