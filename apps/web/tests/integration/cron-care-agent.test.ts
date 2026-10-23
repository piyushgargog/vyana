import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const run = vi.fn(async () => ({ patients: 12, created: 3, expired: 1 }));
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({ marker: "admin" }),
  requireEnv: (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  },
}));
vi.mock("@/lib/server/agent/loop", () => ({ runCareAgentLoop: (...args: unknown[]) => run(...(args as [])) }));

const { POST } = await import("@/app/api/cron/care-agent/route");

const call = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/cron/care-agent", { method: "POST", headers }), undefined);

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret-value-for-tests");
  run.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/cron/care-agent", () => {
  it("runs the loop for the scheduler and returns its counts", async () => {
    const res = await call({ "x-cron-secret": "s3cret-value-for-tests" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ patients: 12, created: 3, expired: 1 });
    expect(run).toHaveBeenCalledTimes(1);
    const [client] = run.mock.calls[0] as unknown as [{ marker: string }];
    expect(client.marker).toBe("admin"); // the service-role client
  });

  it("refuses a call without the secret (401), before touching the database", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret, however close", async () => {
    for (const secret of ["wrong", "s3cret-value-for-tests-x", "S3CRET-VALUE-FOR-TESTS", ""]) {
      const res = await call({ "x-cron-secret": secret });
      expect(res.status, secret).toBe(401);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("turns a failure of the loop into the standard error body", async () => {
    run.mockRejectedValueOnce(new Error("database down"));
    const res = await call({ "x-cron-secret": "s3cret-value-for-tests" });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL");
  });
});
