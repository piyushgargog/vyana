import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openJob, sealJob } from "@/lib/server/jobs";

beforeEach(() => {
  vi.stubEnv("JOB_TOKEN_SECRET", "a".repeat(40));
});
afterEach(() => vi.unstubAllEnvs());

describe("job tokens", () => {
  const payload = { uid: "u1", items: [{ medicine: "Dolo", strength: "650 mg" }] };

  it("round-trips the payload and hides its contents", () => {
    const token = sealJob(payload);
    expect(openJob(token)).toEqual(payload);
    expect(token).not.toContain("Dolo");
    expect(token).toMatch(/^v1\.[A-Za-z0-9_-]+$/);
  });

  it("gives a different token each time", () => {
    expect(sealJob(payload)).not.toBe(sealJob(payload));
  });

  it("rejects a token that was altered", () => {
    const token = sealJob(payload);
    const flipped = token.slice(0, -2) + (token.at(-2) === "A" ? "B" : "A") + token.at(-1);
    expect(openJob(flipped)).toBeNull();
  });

  it("rejects a token made with another secret", () => {
    const token = sealJob(payload);
    vi.stubEnv("JOB_TOKEN_SECRET", "b".repeat(40));
    expect(openJob(token)).toBeNull();
  });

  it("rejects garbage", () => {
    for (const t of ["", "v1.", "v2.abc", "nonsense", "v1.!!!!"]) expect(openJob(t)).toBeNull();
  });

  it("refuses a short secret", () => {
    vi.stubEnv("JOB_TOKEN_SECRET", "short");
    expect(() => sealJob(payload)).toThrow("at least 32");
  });
});
