import { afterEach, describe, expect, it, vi } from "vitest";
import { PATIENT_DATA_PROVIDERS, SUPPORTED_PROVIDERS, getModel, modelName } from "@/lib/server/llm";

afterEach(() => {
  vi.unstubAllEnvs();
});

const configure = (provider: string, model = "some-model", env: Record<string, string> = {}) => {
  vi.stubEnv("LLM_MOCK", "0");
  vi.stubEnv("LLM_PROVIDER", provider);
  vi.stubEnv("LLM_MODEL", model);
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
};

describe("getModel", () => {
  it("builds each wired provider's model once its key is set", () => {
    const keys: Record<string, Record<string, string>> = {
      google: { GOOGLE_GENERATIVE_AI_API_KEY: "k" },
      groq: { GROQ_API_KEY: "k" },
      nvidia: { NVIDIA_API_KEY: "k" },
      openrouter: { OPENROUTER_API_KEY: "k" },
      huggingface: { HF_TOKEN: "k" },
    };
    for (const provider of SUPPORTED_PROVIDERS) {
      configure(provider, `${provider}-model`, keys[provider]);
      const model = getModel("text") as unknown as { modelId: string; provider: string };
      expect(model.modelId, provider).toBe(`${provider}-model`);
    }
  });

  it("uses LLM_TEXT_MODEL for text and LLM_MODEL for vision", () => {
    configure("groq", "vision-model", { GROQ_API_KEY: "k", LLM_TEXT_MODEL: "text-model" });
    expect((getModel("text") as unknown as { modelId: string }).modelId).toBe("text-model");
    expect((getModel("vision") as unknown as { modelId: string }).modelId).toBe("vision-model");
    expect(modelName("text")).toBe("groq:text-model");
  });

  it("says 'not configured' for no provider, an unknown one, or a missing key, never leaking which", () => {
    vi.stubEnv("LLM_MOCK", "0");
    expect(() => getModel("text")).toThrow("isn't configured");
    configure("made-up");
    expect(() => getModel("text")).toThrow("isn't configured");
    configure("groq");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(() => getModel("text")).toThrow("isn't configured");
  });

  it("in production only a provider with recorded terms sees patient text (PLAN §2A rule 9)", () => {
    vi.stubEnv("NODE_ENV", "production");
    configure("google", "m", { GOOGLE_GENERATIVE_AI_API_KEY: "k" });
    expect(() => getModel("text")).toThrow("isn't available");
    configure("groq", "m", { GROQ_API_KEY: "k" });
    expect(() => getModel("text")).not.toThrow();
    configure("google", "m", { GOOGLE_GENERATIVE_AI_API_KEY: "k", LLM_ALLOW_UNAPPROVED: "1" });
    expect(() => getModel("text")).not.toThrow();
    expect(PATIENT_DATA_PROVIDERS).toEqual(["groq"]);
  });
});
