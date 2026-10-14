import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, RATE_LIMITED_ROUTES, RATE_LIMITS, rateLimitOf } from "@vyana/shared";

const VALID = "valid-access-token";
const USER_ID = "3f1b6c2e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";
const getUser = vi.fn();
const rpc = vi.fn();

// Supabase is mocked: tests never touch the network (tests/README.md).
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({ auth: { getUser }, rpc }),
  supabaseForUser: () => ({
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { id: USER_ID, role: "patient", full_name: "Demo Patient" }, error: null }),
      };
      return chain;
    },
  }),
  requireEnv: (name: string) => process.env[name] ?? "",
}));

const { withRoute } = await import("@/lib/server/errors");
const { requireUser } = await import("@/lib/server/auth");

const ran = vi.fn();
const LIMITED = withRoute(
  "test/limited",
  async (req, ctx) => {
    const { user } = await requireUser(req); // a route asks again: the answer is remembered for this request
    ran(ctx.userId, user.id);
    return Response.json({ ok: true });
  },
  { rateLimit: rateLimitOf("ai_other") },
);
const UNLIMITED = withRoute("test/unlimited", async (req) => {
  await requireUser(req);
  return Response.json({ ok: true });
});

const request = (authorization?: string) => new Request("http://localhost/api/test", { method: "POST", headers: authorization ? { authorization } : {} });
const counter = (over: Partial<{ allowed: boolean; remaining: number; seconds: number }> = {}) => ({
  data: [
    {
      allowed: over.allowed ?? true,
      remaining: over.remaining ?? 19,
      reset_at: new Date(Date.now() + (over.seconds ?? 600) * 1000).toISOString(),
    },
  ],
  error: null,
});

beforeEach(() => {
  vi.stubEnv("LLM_MOCK", "");
  vi.stubEnv("TINYFISH_MOCK", "");
  getUser.mockReset().mockImplementation(async (token: string) =>
    token === VALID ? { data: { user: { id: USER_ID, email: "patient@vyana.test" } }, error: null } : { data: { user: null }, error: new Error("invalid JWT") },
  );
  rpc.mockReset().mockResolvedValue(counter());
  ran.mockReset();
});

describe("a route with a rate limit", () => {
  it("counts the call of the signed-in user in its bucket, then runs", async () => {
    const res = await LIMITED(request(`Bearer ${VALID}`), undefined);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("hit_rate_limit", { p_user: USER_ID, p_bucket: "ai_other", p_window_seconds: 3600, p_max: 20 });
    expect(ran).toHaveBeenCalledExactlyOnceWith(USER_ID, USER_ID); // ctx.userId is set before the handler
  });

  it("asks Supabase who the caller is once, not once for the limit and once for the handler", async () => {
    await LIMITED(request(`Bearer ${VALID}`), undefined);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it("answers 429 over the limit, with a plain message and Retry-After, and never runs the handler", async () => {
    rpc.mockResolvedValue(counter({ allowed: false, remaining: 0, seconds: 300 }));
    const res = await LIMITED(request(`Bearer ${VALID}`), undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("300");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    const body = ApiErrorBody.parse(await res.json());
    expect(body.error).toEqual({ code: "RATE_LIMITED", message: "You've reached the limit for now. Try again in 5 minutes." });
    expect(ran).not.toHaveBeenCalled();
  });

  it("says 'minute' for one minute and rounds a part of a minute up", async () => {
    rpc.mockResolvedValue(counter({ allowed: false, remaining: 0, seconds: 45 }));
    const one = await LIMITED(request(`Bearer ${VALID}`), undefined);
    expect((await one.json()).error.message).toBe("You've reached the limit for now. Try again in 1 minute.");
    expect(one.headers.get("retry-after")).toBe("45");

    rpc.mockResolvedValue(counter({ allowed: false, remaining: 0, seconds: 61 }));
    const two = await LIMITED(request(`Bearer ${VALID}`), undefined);
    expect((await two.json()).error.message).toBe("You've reached the limit for now. Try again in 2 minutes.");
  });

  it("never counts a caller who is not signed in: 401 first, and the counter is not touched", async () => {
    for (const authorization of [undefined, "Bearer forged-token", `Basic ${VALID}`]) {
      const res = await LIMITED(request(authorization), undefined);
      expect(res.status, String(authorization)).toBe(401);
      expect(ApiErrorBody.parse(await res.json()).error.code).toBe("UNAUTHORIZED");
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(ran).not.toHaveBeenCalled();
  });

  it("lets the request through when the counter fails (fail open)", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    expect((await LIMITED(request(`Bearer ${VALID}`), undefined)).status).toBe(200);
    rpc.mockRejectedValue(new Error("network down"));
    expect((await LIMITED(request(`Bearer ${VALID}`), undefined)).status).toBe(200);
    expect(ran).toHaveBeenCalledTimes(2);
  });

  it("skips the counter in a mock run", async () => {
    vi.stubEnv("LLM_MOCK", "1");
    expect((await LIMITED(request(`Bearer ${VALID}`), undefined)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("a route without a rate limit", () => {
  it("does not use the counter", async () => {
    expect((await UNLIMITED(request(`Bearer ${VALID}`), undefined)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Which routes of the app are limited (issue 138): read from the route files, so a new route cannot slip through.
// ---------------------------------------------------------------------------------------------------------------------
const API = resolve(__dirname, "../../app/api");
function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === "route.ts" ? [join(dir, e.name)] : []));
}

describe("the routes of the app", () => {
  const found = routeFiles(API).map((file) => {
    const source = readFileSync(file, "utf8");
    // withRoute("name", ...) or withRoute<RouteContext<"/api/x/[id]">>("name", ...)
    const name = /withRoute(?:<[\s\S]*?>>)?\(\s*"([^"]+)"/.exec(source)?.[1] ?? "";
    const bucket = /rateLimit:\s*rateLimitOf\("([a-z_]+)"\)/.exec(source)?.[1] ?? null;
    return { file: relative(API, file).replaceAll("\\", "/"), name, bucket };
  });

  it("are all read (every route file uses withRoute)", () => {
    expect(found.length).toBeGreaterThan(20);
    for (const f of found) expect(f.name, f.file).not.toBe("");
  });

  it("limit exactly the routes in RATE_LIMITED_ROUTES, each in its bucket", () => {
    const limited = Object.fromEntries(found.filter((f) => f.bucket).map((f) => [f.name, f.bucket]));
    expect(limited).toEqual(RATE_LIMITED_ROUTES);
  });

  it("only name buckets that exist", () => {
    for (const f of found) if (f.bucket) expect(Object.keys(RATE_LIMITS), f.file).toContain(f.bucket);
  });

  it("never limit SOS, polling a job, the account, the share page, the cron job or the webhook", () => {
    for (const name of ["emergency/sos", "labs/compare/[job_id]", "prescriptions/basket/[job_id]", "me", "me/export", "share/[token]", "cron/missed-doses", "webhooks/tinyfish-monitor", "reports/values/correct"]) {
      const f = found.find((x) => x.name === name);
      expect(f, name).toBeDefined();
      expect(f?.bucket, name).toBeNull();
    }
  });
});
