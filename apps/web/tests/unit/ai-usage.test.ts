import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

// ai_runs inserts land here (migration 0015 columns: provider, input_tokens, output_tokens, latency_ms).
const inserts: Record<string, unknown>[] = [];
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserts.push(row);
            return { data: { id: "run-1" }, error: null };
          },
        }),
      }),
    }),
  }),
  requireEnv: (n: string) => process.env[n] ?? "",
}));

const { providerOf, runAi } = await import("@/lib/server/ai");

const schema = z.object({ name: z.string() });
const base = {
  feature: "test_feature",
  kind: "text" as const,
  schema,
  promptVersion: "test@1",
  sources: [],
  userId: "u1",
  prompt: "Answer",
  mock: { name: "[mock] Answer" },
};

beforeEach(() => {
  inserts.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ai_runs usage (migration 0015)", () => {
  beforeEach(() => {
    vi.stubEnv("LLM_MOCK", "1");
  });

  it("records provider mock, no tokens and a measured latency for a mocked call", async () => {
    await runAi(base);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].provider).toBe("mock");
    expect(inserts[0].input_tokens).toBeNull();
    expect(inserts[0].output_tokens).toBeNull();
    expect(typeof inserts[0].latency_ms).toBe("number");
    expect(inserts[0].latency_ms as number).toBeGreaterThanOrEqual(0);
  });
});

describe("providerOf", () => {
  it("takes the provider before the first colon of a configured model", () => {
    expect(providerOf("groq:qwen/qwen3.8-27b")).toBe("groq");
  });

  it("skips the fallback prefix, so the answering provider is named", () => {
    expect(providerOf("fallback:nvidia:nvidia/nemotron")).toBe("nvidia");
  });
});
