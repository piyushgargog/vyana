import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

// ai_runs inserts land here; `failInsert` simulates a database error.
const inserts: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
let failInsert = false;
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            if (failInsert) return { data: null, error: new Error("db down") };
            inserts.push(row);
            return { data: { id: "run-1" }, error: null };
          },
        }),
      }),
      update: (row: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(row);
          return { error: null };
        },
      }),
    }),
  }),
  requireEnv: (n: string) => process.env[n] ?? "",
}));

// The model the real path uses: replies come from `replies`, one per call.
let replies: string[] = [];
const calls: { temperature?: number }[] = [];
vi.mock("@/lib/server/llm", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/llm")>()),
  getModel: () =>
    new MockLanguageModelV4({
      doGenerate: async (options: { temperature?: number }) => {
        calls.push({ temperature: options.temperature });
        const text = replies.shift() ?? "{}";
        return {
          content: [{ type: "text", text }],
          finishReason: { unified: "stop", raw: undefined },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 1, text: 1, reasoning: undefined },
          },
          warnings: [],
        };
      },
    }),
}));

const { runAi, UNREADABLE_MESSAGE, fallbackOf, finishAiRun, startAiRun } = await import("@/lib/server/ai");
const { getModel } = await vi.importActual<typeof import("@/lib/server/llm")>("@/lib/server/llm");

const schema = z.object({ name: z.string(), phone: z.string().nullable() });
const base = {
  feature: "test_feature",
  kind: "text" as const,
  schema,
  promptVersion: "test@1",
  sources: [{ title: "Page", url: "https://example.org/a" }],
  userId: "u1",
  prompt: "Extract the hospital",
  mock: { name: "[mock] Hospital", phone: null },
};

beforeEach(() => {
  inserts.length = 0;
  updates.length = 0;
  calls.length = 0;
  replies = [];
  failInsert = false;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runAi in mock mode", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_MOCK", "1");
  });

  it("returns the fixture without calling a model and records the run", async () => {
    const res = await runAi({ ...base, statusOf: () => "needs_review" });
    expect(res.object).toEqual(base.mock);
    expect(res.ai).toMatchObject({ model: "mock", prompt_version: "test@1" });
    expect(res.runId).toBe("run-1");
    expect(calls).toHaveLength(0);
    expect(inserts[0]).toMatchObject({ feature: "test_feature", model: "mock", status: "needs_review", user_id: "u1", sources: base.sources });
  });

  it("still validates the fixture against the schema", async () => {
    await expect(runAi({ ...base, mock: { name: 1 } as never })).rejects.toThrow();
  });
});

describe("runAi with a model", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_MOCK", "0");
    vi.stubEnv("LLM_PROVIDER", "test");
    vi.stubEnv("LLM_MODEL", "test-model");
  });

  it("asks for structured output at temperature 0", async () => {
    replies = [JSON.stringify({ name: "AIIMS", phone: "011-26588500" })];
    const res = await runAi(base);
    expect(res.object).toEqual({ name: "AIIMS", phone: "011-26588500" });
    expect(calls).toEqual([{ temperature: 0 }]);
    expect(inserts[0]).toMatchObject({ model: "test:test-model", status: "ok" });
  });

  it("retries once when the output doesn't match the schema", async () => {
    replies = [JSON.stringify({ name: 42 }), JSON.stringify({ name: "AIIMS", phone: null })];
    expect((await runAi(base)).object).toEqual({ name: "AIIMS", phone: null });
    expect(calls).toHaveLength(2);
  });

  it("gives up after the retry with a safe 502, never a half-guess", async () => {
    replies = ["not json", "still not json"];
    await expect(runAi(base)).rejects.toMatchObject({ code: "UPSTREAM_ERROR", status: 502, message: UNREADABLE_MESSAGE });
    expect(calls).toHaveLength(2);
    expect(inserts).toHaveLength(0);
  });

  it("returns the result even when the ai_runs insert fails", async () => {
    failInsert = true;
    replies = [JSON.stringify({ name: "AIIMS", phone: null })];
    const res = await runAi(base);
    expect(res.runId).toBeNull();
    expect(res.object.name).toBe("AIIMS");
  });
});

describe("getModel", () => {
  it("refuses until a known provider is configured", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    expect(() => getModel("text")).toThrow("isn't configured");
    vi.stubEnv("LLM_PROVIDER", "made-up-provider");
    vi.stubEnv("LLM_MODEL", "some-model");
    expect(() => getModel("vision")).toThrow("isn't configured");
  });
});

describe("fallbackOf", () => {
  it("reads the fallback key from the pool metadata, and nothing when the primary answered", () => {
    expect(fallbackOf({ vyana_pool: { fallback: "groq:small-model" } })).toBe("groq:small-model");
    expect(fallbackOf({})).toBeNull();
    expect(fallbackOf(undefined)).toBeNull();
  });
});

describe("finishAiRun", () => {
  const record = { feature: "assistant_chat", userId: "u1", promptVersion: "assistant@1", inputRef: "chat_sessions/s1", sources: [] };

  it("writes the model that really answered onto the run row (#691)", async () => {
    const runId = await startAiRun(record, "text");
    expect(runId).toBe("run-1");
    await finishAiRun(runId, { output: { text: "hi" }, sources: [], status: "ok", model: "fallback:groq:small-model", usage: { provider: "groq", input_tokens: 1, output_tokens: 1, latency_ms: 2 } });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ model: "fallback:groq:small-model", status: "ok", provider: "groq" });
  });

  it("leaves the model column alone when no model is given", async () => {
    await finishAiRun("run-1", { output: { text: "hi" }, sources: [], status: "ok" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("model");
  });

  it("does nothing without a run id", async () => {
    await finishAiRun(null, { output: { text: "hi" }, sources: [], status: "ok", model: "fallback:groq:small-model" });
    expect(updates).toHaveLength(0);
  });
});
