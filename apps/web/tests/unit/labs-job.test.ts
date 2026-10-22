import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const getRunMock = vi.fn();
const cancelRunMock = vi.fn();
vi.mock("@/lib/server/tinyfish/client", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/tinyfish/client")>()),
  getRun: (...a: unknown[]) => getRunMock(...a),
  cancelRun: (...a: unknown[]) => cancelRunMock(...a),
}));

const { pollLabJob } = await import("@/lib/server/tinyfish/labs");
const { QUEUE_DEADLINE_MS, RUN_DEADLINE_MS } = await import("@/lib/server/tinyfish/basket");
const { sealJob } = await import("@/lib/server/jobs");

const NOW = Date.parse("2026-10-12T10:00:00Z");
const job = (startedAgoMs: number) =>
  sealJob({
    v: 1,
    kind: "labs",
    uid: USER_ID,
    test: "HbA1c",
    city: "Delhi",
    runs: [{ source: "healthians", run_id: "run-1", start_url: "https://www.healthians.com/" }],
    started_at: NOW - startedAgoMs,
  });

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("JOB_TOKEN_SECRET", "z".repeat(40));
  resetDb();
  getRunMock.mockReset();
  cancelRunMock.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const poll = async (token: string) => (await pollLabJob(USER_ID, token, { tinyfishCalls: 0 })).sources[0];

describe("lab job deadlines", () => {
  it("gives up on a run that waited in the queue too long", async () => {
    getRunMock.mockResolvedValue({ status: "PENDING", result: null, error: null, startedAt: null });
    expect((await poll(job(QUEUE_DEADLINE_MS + 1000))).status).toBe("timeout");
    expect(cancelRunMock).toHaveBeenCalledWith("run-1", expect.anything());
  });

  it("does not time out a run that has started, however long it waited in the queue", async () => {
    // The job is older than the queue deadline, but this run left the queue 10 s ago:
    // the queue deadline counts the wait, not the run (its own deadline runs from startedAt).
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - 10_000 });
    expect((await poll(job(QUEUE_DEADLINE_MS + 20_000))).status).toBe("pending");
    expect(cancelRunMock).not.toHaveBeenCalled();
  });

  it("times out a run that has been running past its own deadline", async () => {
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - RUN_DEADLINE_MS - 1000 });
    expect((await poll(job(60_000))).status).toBe("timeout");
    expect(cancelRunMock).toHaveBeenCalledWith("run-1", expect.anything());
  });
});
