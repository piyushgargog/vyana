import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireEnv } from "@/lib/server/supabase-admin";

const run = vi.fn(async () => ({ checked: 3, alerts_sent: 2 }));
const runLate = vi.fn(async () => ({ checked: 5, patient_sent: 1, caregiver_sent: 1 }));
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({ marker: "admin" }),
  requireEnv: (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  },
}));
vi.mock("@/lib/server/data/missed-doses", () => ({ runMissedDoseCheck: (...args: unknown[]) => run(...(args as [])) }));
vi.mock("@/lib/server/data/late-doses", () => ({ runLateDoseCheck: (...args: unknown[]) => runLate(...(args as [])) }));

const { POST } = await import("@/app/api/cron/missed-doses/route");

const call = (headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/cron/missed-doses", { method: "POST", headers }), undefined);

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret-value-for-tests");
  run.mockClear();
  runLate.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/cron/missed-doses", () => {
  it("runs the check for the scheduler and returns its counts", async () => {
    const res = await call({ "x-cron-secret": "s3cret-value-for-tests" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 3, alerts_sent: 2, late_checked: 5, late_patient_sent: 1, late_caregiver_sent: 1 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(runLate).toHaveBeenCalledTimes(1);
    const [client, send] = run.mock.calls[0] as unknown as [{ marker: string }, unknown];
    expect(client.marker).toBe("admin"); // the service-role client
    expect(typeof send).toBe("function"); // sendPush
  });

  it("refuses a call without the secret (401), before touching the database", async () => {
    const res = await call();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret, however close", async () => {
    for (const secret of ["wrong", "s3cret-value-for-tests-x", "S3CRET-VALUE-FOR-TESTS", "s3cret-value-for-test", ""]) {
      const res = await call({ "x-cron-secret": secret });
      expect(res.status, secret).toBe(401);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("does not accept a user token or a bearer header instead of the secret", async () => {
    const res = await call({ authorization: "Bearer s3cret-value-for-tests" });
    expect(res.status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("fails closed (500) when CRON_SECRET is not set on the server, never open", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await call({ "x-cron-secret": "" });
    expect(res.status).toBe(500);
    expect(run).not.toHaveBeenCalled();
    expect(() => requireEnv("CRON_SECRET")).toThrow("Missing environment variable CRON_SECRET");
  });

  it("turns a failure of the check into the standard error body", async () => {
    run.mockRejectedValueOnce(new Error("database down"));
    const res = await call({ "x-cron-secret": "s3cret-value-for-tests" });
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("INTERNAL");
  });
});
