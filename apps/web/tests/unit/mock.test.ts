import { afterEach, describe, expect, it, vi } from "vitest";
import { isLlmMock, isMockRun, isWebMock } from "@/lib/server/mock";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mock flags", () => {
  it("answers each flag on its own, and a mock run on either", () => {
    vi.stubEnv("LLM_MOCK", "1");
    vi.stubEnv("WEB_MOCK", "0");
    expect(isLlmMock()).toBe(true);
    expect(isWebMock()).toBe(false);
    expect(isMockRun()).toBe(true);

    vi.stubEnv("LLM_MOCK", "0");
    vi.stubEnv("WEB_MOCK", "1");
    expect(isLlmMock()).toBe(false);
    expect(isWebMock()).toBe(true);
    expect(isMockRun()).toBe(true);
  });

  it("is not a mock run when both flags are off", () => {
    vi.stubEnv("LLM_MOCK", "0");
    vi.stubEnv("WEB_MOCK", "");
    expect(isLlmMock()).toBe(false);
    expect(isWebMock()).toBe(false);
    expect(isMockRun()).toBe(false);
  });
});
