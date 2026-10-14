import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let adminError: Error | null = null;

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => {
    if (adminError) throw adminError;
    return { rpc };
  },
  requireEnv: (name: string) => process.env[name] ?? "",
}));

const { checkRateLimit } = await import("@/lib/server/rate-limit");

const USER = "11111111-1111-4111-8111-111111111111";
const LIMIT = { bucket: "ai_chat", windowSeconds: 600, max: 20 };
const NOW = new Date("2026-10-15T06:00:00.000Z");
const row = (over: Partial<{ allowed: boolean; remaining: number; reset_at: string }> = {}) => ({
  data: [{ allowed: true, remaining: 19, reset_at: "2026-10-15T06:10:00.000Z", ...over }],
  error: null,
});

beforeEach(() => {
  rpc.mockReset();
  adminError = null;
  vi.stubEnv("LLM_MOCK", "");
  vi.stubEnv("TINYFISH_MOCK", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("counts one call of the user in the bucket, with the window and the maximum", async () => {
    rpc.mockResolvedValue(row());
    await checkRateLimit(USER, LIMIT, NOW);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("hit_rate_limit", { p_user: USER, p_bucket: "ai_chat", p_window_seconds: 600, p_max: 20 });
  });

  it("allows a call that is within the limit", async () => {
    rpc.mockResolvedValue(row({ allowed: true, remaining: 7 }));
    expect(await checkRateLimit(USER, LIMIT, NOW)).toEqual({ allowed: true, remaining: 7, retryAfterSeconds: 600 });
  });

  it("refuses a call over the limit and says in how many seconds the window ends", async () => {
    rpc.mockResolvedValue(row({ allowed: false, remaining: 0, reset_at: "2026-10-15T06:04:10.000Z" }));
    expect(await checkRateLimit(USER, LIMIT, NOW)).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 250 });
  });

  it("rounds a part of a second up, and never says less than 1 second", async () => {
    rpc.mockResolvedValue(row({ allowed: false, remaining: 0, reset_at: "2026-10-15T06:00:00.200Z" }));
    expect((await checkRateLimit(USER, LIMIT, NOW))?.retryAfterSeconds).toBe(1);
    rpc.mockResolvedValue(row({ allowed: false, remaining: 0, reset_at: "2026-10-15T05:59:00.000Z" })); // clocks that differ
    expect((await checkRateLimit(USER, LIMIT, NOW))?.retryAfterSeconds).toBe(1);
  });

  it("accepts a single row as well as a list of rows", async () => {
    rpc.mockResolvedValue({ data: { allowed: false, remaining: 0, reset_at: "2026-10-15T06:01:00.000Z" }, error: null });
    expect(await checkRateLimit(USER, LIMIT, NOW)).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
  });
});

describe("fail open: no verdict means the request goes through", () => {
  it("when the database answers with an error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "permission denied", code: "42501" } });
    expect(await checkRateLimit(USER, LIMIT, NOW)).toBeNull();
  });

  it("when the call throws or rejects", async () => {
    rpc.mockRejectedValue(new Error("network down"));
    expect(await checkRateLimit(USER, LIMIT, NOW)).toBeNull();
    rpc.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(await checkRateLimit(USER, LIMIT, NOW)).toBeNull();
  });

  it("when the admin client cannot be made (a missing environment variable)", async () => {
    adminError = new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY");
    expect(await checkRateLimit(USER, LIMIT, NOW)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("when the answer has an unexpected shape", async () => {
    for (const data of [null, [], [{}], [{ allowed: "yes", remaining: 1, reset_at: "2026-10-15T06:10:00Z" }], [{ allowed: true, remaining: "1", reset_at: "2026-10-15T06:10:00Z" }], [{ allowed: true, remaining: 1, reset_at: "soon" }]]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await checkRateLimit(USER, LIMIT, NOW), JSON.stringify(data)).toBeNull();
    }
  });

  it("when the counter does not answer within 2 seconds", async () => {
    vi.useFakeTimers();
    rpc.mockReturnValue(new Promise(() => {}));
    const verdict = checkRateLimit(USER, LIMIT, NOW);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await verdict).toBeNull();
  });
});

describe("mock runs", () => {
  it.each(["LLM_MOCK", "TINYFISH_MOCK"])("are not counted when %s=1, and the database is not asked", async (name) => {
    vi.stubEnv(name, "1");
    expect(await checkRateLimit(USER, LIMIT, NOW)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
