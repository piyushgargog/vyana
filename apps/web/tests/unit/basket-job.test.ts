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

const { QUEUE_DEADLINE_MS, RUN_DEADLINE_MS, pollBasketJob, runDeadlineMs } = await import("@/lib/server/tinyfish/basket");
const { sealJob } = await import("@/lib/server/jobs");

const NOW = Date.parse("2026-10-12T10:00:00Z");
const job = (startedAgoMs: number) =>
  sealJob({
    v: 1,
    uid: USER_ID,
    key: "k",
    items: [{ medicine: "Dolo", strength: "650 mg", quantity: 1 }],
    runs: [{ source: "1mg", run_id: "run-1", error: null }],
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

const poll = async (token: string) => (await pollBasketJob(USER_ID, token, { tinyfishCalls: 0 })).baskets[0];

describe("basket job deadlines", () => {
  it("keeps a queued run pending while the account's browsers are busy", async () => {
    getRunMock.mockResolvedValue({ status: "PENDING", result: null, error: null, startedAt: null });
    expect((await poll(job(QUEUE_DEADLINE_MS - 1000))).status).toBe("pending");
    expect(cancelRunMock).not.toHaveBeenCalled();
  });

  it("gives up on a run that waited in the queue too long", async () => {
    getRunMock.mockResolvedValue({ status: "PENDING", result: null, error: null, startedAt: null });
    expect((await poll(job(QUEUE_DEADLINE_MS + 1000))).status).toBe("timeout");
    expect(cancelRunMock).toHaveBeenCalledWith("run-1", expect.anything());
  });

  it("counts a running run's time from when it left the queue, not from the job start", async () => {
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - 60_000 });
    expect((await poll(job(300_000))).status).toBe("pending");
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - RUN_DEADLINE_MS - 1000 });
    expect((await poll(job(300_000))).status).toBe("timeout");
    expect(cancelRunMock).toHaveBeenCalledTimes(1);
  });

  it("gives a multi-item basket a longer run deadline than a single item (#225)", async () => {
    const bigJob = sealJob({
      v: 1,
      uid: USER_ID,
      key: "k",
      items: Array.from({ length: 10 }, (_, i) => ({ medicine: `Med ${i}`, strength: "10 mg", quantity: 1 })),
      runs: [{ source: "1mg", run_id: "run-1", error: null }],
      started_at: NOW - 300_000,
    });
    // Past the single-item deadline, still inside the 10-item one: pending, not cancelled.
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - RUN_DEADLINE_MS - 1000 });
    expect((await poll(bigJob)).status).toBe("pending");
    expect(cancelRunMock).not.toHaveBeenCalled();
    // Past the scaled deadline: given up as a timeout.
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - runDeadlineMs(10) - 1000 });
    expect((await poll(bigJob)).status).toBe("timeout");
    expect(cancelRunMock).toHaveBeenCalledTimes(1);
  });

  it("does not time out a run that has started, however long it waited in the queue", async () => {
    // The job is older than the queue deadline, but this run left the queue 10 s ago:
    // the queue deadline counts the wait, not the run (its own deadline runs from startedAt).
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW - 10_000 });
    expect((await poll(job(QUEUE_DEADLINE_MS + 20_000))).status).toBe("pending");
    expect(cancelRunMock).not.toHaveBeenCalled();
  });

  it("maps failed runs and does not cache them", async () => {
    getRunMock.mockResolvedValueOnce({ status: "FAILED", result: null, error: "SITE_BLOCKED", startedAt: NOW });
    expect((await poll(job(10_000))).status).toBe("error");
    getRunMock.mockResolvedValueOnce({ status: "FAILED", result: null, error: "TIMEOUT", startedAt: NOW });
    expect((await poll(job(10_000))).status).toBe("timeout");
    expect(getRunMock).toHaveBeenCalledTimes(2);
  });

  it("reports the job as running until no basket is pending", async () => {
    getRunMock.mockResolvedValue({ status: "RUNNING", result: null, error: null, startedAt: NOW });
    expect((await pollBasketJob(USER_ID, job(5_000), { tinyfishCalls: 0 })).status).toBe("running");
  });
});
