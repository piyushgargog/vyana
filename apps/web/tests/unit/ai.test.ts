import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";

// ai_runs inserts land here; `failInsert` simulates a database error.
const inserts: Record<string, unknown>[] = [];
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

const { runAi, UNREADABLE_MESSAGE } = await import("@/lib/server/ai");
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
  it("refuses until a provider is configured and installed", () => {
    vi.stubEnv("LLM_PROVIDER", "");
    expect(() => getModel("text")).toThrow("isn't configured");
    vi.stubEnv("LLM_PROVIDER", "google");
    vi.stubEnv("LLM_MODEL", "some-model");
    expect(() => getModel("vision")).toThrow("isn't configured");
  });
});
