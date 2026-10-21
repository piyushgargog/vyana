import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, generateText, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";

/**
 * ADR-056: several keys, models and providers. The provider factories are replaced by scripted models, so the
 * tests show which key / model answered and when the next candidate is tried.
 */

type Behaviour = number | "json_validate_failed" | "ok"; // an HTTP status to fail with, a Groq 400 that rejects the model's output, or "ok"
const script = new Map<string, Behaviour>(); // "provider|key|model" -> behaviour (default "ok")
const calls: string[] = [];
const prompts = new Map<string, unknown>(); // "provider|key|model" -> the last prompt it received

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

function scripted(provider: string, apiKey: string, id: string) {
  const name = `${provider}|${apiKey}|${id}`;
  const attempt = () => {
    calls.push(name);
    const b = script.get(name) ?? "ok";
    if (b === "json_validate_failed") throw new APICallError({ message: "status 400", url: "https://x.test", requestBodyValues: {}, statusCode: 400, responseBody: '{"error":{"code":"json_validate_failed"}}' });
    if (b !== "ok") throw new APICallError({ message: `status ${b}`, url: "https://x.test", requestBodyValues: {}, statusCode: b });
  };
  return new MockLanguageModelV4({
    provider,
    modelId: id,
    doGenerate: async (options) => {
      prompts.set(name, options.prompt);
      attempt();
      return { content: [{ type: "text", text: name }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] };
    },
    doStream: async () => {
      attempt();
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "text-start", id: "t" });
            controller.enqueue({ type: "text-delta", id: "t", delta: name });
            controller.enqueue({ type: "text-end", id: "t" });
            controller.enqueue({ type: "finish", finishReason: { unified: "stop", raw: undefined }, usage });
            controller.close();
          },
        }),
      };
    },
  });
}

vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (o: { name: string; apiKey: string }) => (id: string) => scripted(o.name, o.apiKey, id),
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: (o: { apiKey: string }) => (id: string) => scripted("google", o.apiKey, id),
}));

const { getModel, isRetryable, isOutputRejected, keysFor, resetKeyRotation } = await import("@/lib/server/llm");

beforeEach(() => {
  resetKeyRotation();
  script.clear();
  calls.length = 0;
  vi.stubEnv("LLM_MOCK", "0");
  vi.stubEnv("LLM_PROVIDER", "groq");
  vi.stubEnv("LLM_MODEL", "main-model");
  for (const v of ["LLM_TEXT_MODEL", "LLM_FALLBACKS", "LLM_VISION_FALLBACKS", "GROQ_API_KEY", "GROQ_API_KEYS", "NVIDIA_API_KEY", "NVIDIA_API_KEYS", "GOOGLE_GENERATIVE_AI_API_KEY", "LLM_ALLOW_UNAPPROVED"]) {
    vi.stubEnv(v, "");
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const ask = async (data?: "patient" | "public") =>
  (await generateText({ model: getModel("text", data ? { data } : {}), prompt: "hi", maxRetries: 0 })).text;

describe("keys", () => {
  it("merges the single key and the comma separated list, without duplicates", () => {
    vi.stubEnv("GROQ_API_KEY", "k1");
    vi.stubEnv("GROQ_API_KEYS", "k2, k3 ,k1,");
    expect(keysFor("groq")).toEqual(["k1", "k2", "k3"]);
  });

  it("rotates the first key round-robin, call after call", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2,k3");
    expect(await ask()).toBe("groq|k1|main-model");
    expect(await ask()).toBe("groq|k2|main-model");
    expect(await ask()).toBe("groq|k3|main-model");
    expect(await ask()).toBe("groq|k1|main-model");
  });

  it("with one key and no fallbacks it is the provider model itself (only reasoning is dropped)", async () => {
    vi.stubEnv("GROQ_API_KEY", "only");
    const model = getModel("text") as unknown as { modelId: string; provider: string };
    expect(model.modelId).toBe("main-model");
    expect(model.provider).toBe("groq");
    expect(await ask()).toBe("groq|only|main-model");
  });
});

describe("failover (retryable failures only)", () => {
  it("goes to the next key on 429 and on 413", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2,k3");
    script.set("groq|k1|main-model", 429);
    script.set("groq|k2|main-model", 413);
    expect(await ask()).toBe("groq|k3|main-model");
    expect(calls).toEqual(["groq|k1|main-model", "groq|k2|main-model", "groq|k3|main-model"]);
  });

  it("goes on to a fallback model and provider after every key of the first one failed", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    vi.stubEnv("NVIDIA_API_KEY", "n1");
    vi.stubEnv("LLM_FALLBACKS", "groq:small-model,nvidia:big:model");
    vi.stubEnv("LLM_ALLOW_UNAPPROVED", "1");
    script.set("groq|k1|main-model", 429);
    script.set("groq|k2|main-model", 429);
    script.set("groq|k1|small-model", 500);
    script.set("groq|k2|small-model", 503);
    expect(await ask()).toBe("nvidia|n1|big:model"); // a model id may contain colons
  });

  it("does not try another candidate after a 400: that is a bug, not a limit", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    script.set("groq|k1|main-model", 400);
    await expect(ask()).rejects.toThrow("status 400");
    expect(calls).toEqual(["groq|k1|main-model"]);
  });

  it("goes on after a 400 that only says the model's output was rejected (a long care plan), not after other 400s", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1");
    vi.stubEnv("NVIDIA_API_KEY", "n1");
    vi.stubEnv("LLM_FALLBACKS", "nvidia:big-model");
    vi.stubEnv("LLM_ALLOW_UNAPPROVED", "1");
    script.set("groq|k1|main-model", "json_validate_failed");
    expect(await ask("public")).toBe("nvidia|n1|big-model");
  });

  it("throws the last error when every candidate fails", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    script.set("groq|k1|main-model", 429);
    script.set("groq|k2|main-model", 503);
    await expect(ask()).rejects.toThrow("status 503");
  });

  it("falls back for a stream that fails before its first byte", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    script.set("groq|k1|main-model", 429);
    const result = streamText({ model: getModel("text"), prompt: "hi", maxRetries: 0 });
    expect(await result.text).toBe("groq|k2|main-model");
  });

  it("never sends earlier reasoning back, to the main model or a fallback (P24)", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    vi.stubEnv("LLM_FALLBACKS", "groq:small-model");
    const messages = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: [{ type: "reasoning" as const, text: "thinking" }, { type: "text" as const, text: "hello" }] },
      { role: "assistant" as const, content: [{ type: "reasoning" as const, text: "only thoughts" }] },
      { role: "user" as const, content: "and now?" },
    ];
    const types = (name: string) => (prompts.get(name) as { role: string; content: { type: string }[] | string }[]).map((m) => (typeof m.content === "string" ? m.role : `${m.role}:${m.content.map((p) => p.type).join("+")}`));
    script.set("groq|k1|main-model", 429);
    expect((await generateText({ model: getModel("text"), messages, maxRetries: 0 })).text).toBe("groq|k2|main-model");
    expect(types("groq|k2|main-model").filter((t) => t.startsWith("assistant"))).toEqual(["assistant:text"]); // Groq refuses reasoning from any model
    script.set("groq|k2|main-model", 429);
    const answered = (await generateText({ model: getModel("text"), messages, maxRetries: 0 })).text;
    expect(["groq|k1|small-model", "groq|k2|small-model"]).toContain(answered);
    expect(types(answered).filter((t) => t.startsWith("assistant"))).toEqual(["assistant:text"]); // and for a fallback
  });

  it("marks the result when a fallback answered, so ai_runs records the model that really did", async () => {
    vi.stubEnv("GROQ_API_KEYS", "k1,k2");
    vi.stubEnv("LLM_FALLBACKS", "groq:small-model");
    const meta = async () => (await generateText({ model: getModel("text"), prompt: "hi", maxRetries: 0 })).providerMetadata?.vyana_pool;
    expect(await meta()).toBeUndefined(); // the primary answered
    script.set("groq|k1|main-model", 429);
    script.set("groq|k2|main-model", 429);
    expect(await meta()).toEqual({ fallback: "groq:small-model" });
  });

  it("classifies errors", () => {
    expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 413 }))).toBe(true);
    expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 429 }))).toBe(true);
    expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 502 }))).toBe(true);
    expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 400 }))).toBe(false);
    for (const statusCode of [401, 402, 403, 408]) expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode }))).toBe(true); // a dead key must not stop the other keys
    expect(isRetryable(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 404 }))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(Object.assign(new Error("t"), { name: "TimeoutError" }))).toBe(true);
    expect(isRetryable(new Error("boom"))).toBe(false);
    const rejected = new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 400, responseBody: '{"error":{"code":"json_validate_failed"}}' });
    expect(isOutputRejected(rejected)).toBe(true);
    expect(isOutputRejected(new APICallError({ message: "m", url: "u", requestBodyValues: {}, statusCode: 400, responseBody: '{"error":{"code":"invalid_request"}}' }))).toBe(false);
    expect(isOutputRejected(new Error("boom"))).toBe(false);
  });
});

describe("privacy gate per call (PLAN §2A rule 9)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GROQ_API_KEY", "k1");
    vi.stubEnv("NVIDIA_API_KEY", "n1");
    vi.stubEnv("LLM_FALLBACKS", "nvidia:big-model");
    script.set("groq|k1|main-model", 429);
  });

  it("patient data never falls back to a provider without recorded terms", async () => {
    await expect(ask("patient")).rejects.toThrow("status 429");
    expect(calls).toEqual(["groq|k1|main-model"]);
    await expect(ask()).rejects.toThrow("status 429"); // patient is the default
  });

  it("a public call (no patient data) may use any wired provider", async () => {
    expect(await ask("public")).toBe("nvidia|n1|big-model");
  });

  it("LLM_ALLOW_UNAPPROVED=1 opens it for synthetic demos", async () => {
    vi.stubEnv("LLM_ALLOW_UNAPPROVED", "1");
    expect(await ask("patient")).toBe("nvidia|n1|big-model");
  });

  it("patient data with only unapproved providers configured is refused, a public call is not", async () => {
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("LLM_FALLBACKS", "");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => getModel("text")).toThrow("isn't available");
    expect(() => getModel("text", { data: "public" })).not.toThrow();
  });

  it("an unknown provider in the fallback list is ignored, and a fallback without a key is skipped", async () => {
    vi.stubEnv("LLM_FALLBACKS", "made-up:x,nvidia:big-model");
    vi.stubEnv("NVIDIA_API_KEY", "");
    await expect(ask("public")).rejects.toThrow("status 429");
    expect(calls).toEqual(["groq|k1|main-model"]);
  });
});
