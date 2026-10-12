import "server-only";
import type { LanguageModel } from "ai";

/**
 * The assistant's model when `LLM_MOCK=1` (SPEC §11): a fixed script, so the whole chat path (tools, link filter,
 * notes, saving) runs without a provider. Step 1 calls `get_my_medicines` when the user asks about their medicines,
 * else `search_health_web`; step 2 answers from that tool's result, citing the first search result.
 */

type PromptPart = { type: string; text?: string; toolName?: string; output?: { type: string; value?: unknown } };
type PromptMessage = { role: string; content: string | PromptPart[] };
type StreamPart = Record<string, unknown> & { type: string };

const USAGE = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

const MY_MEDICINES = /\b(my|meri|mere|mujhe)\b.*\b(medicines?|meds|tablets?|dawai|dawaiyan|dawa)\b|मेरी.*दवा/i;

function textOf(m: PromptMessage): string {
  return typeof m.content === "string" ? m.content : m.content.filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
}

function stream(parts: StreamPart[]): ReadableStream<StreamPart> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(p);
      controller.close();
    },
  });
}

function textParts(text: string): StreamPart[] {
  // Split into words so the link filter sees text arriving in pieces, like a real model.
  const deltas = text.match(/\S+\s*/g) ?? [text];
  return [
    { type: "text-start", id: "t1" },
    ...deltas.map((delta) => ({ type: "text-delta", id: "t1", delta })),
    { type: "text-end", id: "t1" },
    { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage: USAGE },
  ];
}

function answer(toolName: string, value: unknown): string {
  if (toolName === "get_my_medicines") {
    const meds = (value as { medicines?: { medicine_name: string; strength: string | null }[] }).medicines ?? [];
    if (!meds.length) return "[mock] You have no active medicines saved in Vyana.";
    return `[mock] Your active medicines: ${meds.map((m) => (m.strength ? `${m.medicine_name} ${m.strength}` : m.medicine_name)).join(", ")}.`;
  }
  const first = (value as { results?: { title: string; url: string }[] }).results?.[0];
  if (!first) return "[mock] I couldn't find a trusted source for this. Please ask your doctor.";
  return `[mock] Here is what a trusted source says: [${first.title}](${first.url}). Please talk to your doctor before changing anything.`;
}

export function scriptedAssistantModel(): LanguageModel {
  const model = {
    specificationVersion: "v4",
    provider: "mock",
    modelId: "assistant-script",
    supportedUrls: {},
    doGenerate: async () => {
      throw new Error("The scripted assistant model only streams.");
    },
    doStream: async (options: { prompt: PromptMessage[] }) => {
      const prompt = options.prompt;
      const lastUser = prompt.map((m) => m.role).lastIndexOf("user");
      const toolMessage = prompt.slice(lastUser + 1).find((m) => m.role === "tool");
      const result = Array.isArray(toolMessage?.content) ? toolMessage.content.find((p) => p.type === "tool-result") : undefined;

      if (result?.toolName) return { stream: stream(textParts(answer(result.toolName, result.output?.value))) };

      const question = lastUser >= 0 ? textOf(prompt[lastUser]) : "";
      const call = MY_MEDICINES.test(question)
        ? { toolName: "get_my_medicines", input: "{}" }
        : { toolName: "search_health_web", input: JSON.stringify({ query: question.slice(0, 100) || "health" }) };
      return {
        stream: stream([
          { type: "tool-call", toolCallId: "call-1", ...call },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage: USAGE },
        ]),
      };
    },
  };
  return model as unknown as LanguageModel;
}
