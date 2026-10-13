import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiKeys, cancelRun, getRun, resetCreditGuard, splitRunId, startAgent } from "@/lib/server/tinyfish/client";

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const keyOf = (call: Parameters<typeof fetch>) => (call[1]?.headers as Record<string, string>)["X-API-Key"];
const params = { url: "https://example.com", goal: "g", maxSeconds: 60 };

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "0");
  vi.stubEnv("TINYFISH_API_KEY", "single-key");
  vi.stubEnv("TINYFISH_API_KEYS", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetCreditGuard();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("key pool", () => {
  it("uses the single key, and plain run ids, when there is no pool", async () => {
    expect(apiKeys()).toEqual(["single-key"]);
    fetchMock.mockResolvedValue(json({ run_id: "r1", error: null }));
    expect(await startAgent(params)).toEqual({ status: "started", runId: "r1" });
    expect(keyOf(fetchMock.mock.calls[0])).toBe("single-key");
  });

  it("reads the pool from TINYFISH_API_KEYS and ignores blanks", () => {
    vi.stubEnv("TINYFISH_API_KEYS", " a , ,b,c ");
    expect(apiKeys()).toEqual(["a", "b", "c"]);
  });

  it("starts runs on the keys in turn and tags each run id with its key", async () => {
    vi.stubEnv("TINYFISH_API_KEYS", "k0,k1,k2");
    fetchMock.mockImplementation(async () => json({ run_id: `run-${fetchMock.mock.calls.length}`, error: null }));
    const out = await Promise.all([startAgent(params), startAgent(params), startAgent(params), startAgent(params)]);
    const ids = out.map((o) => (o.status === "started" ? o.runId : ""));
    const keys = fetchMock.mock.calls.map(keyOf);
    expect(new Set(keys.slice(0, 3)).size).toBe(3); // three different keys for three runs
    expect(ids.every((id) => /^[012]~run-\d$/.test(id))).toBe(true);
    ids.forEach((id, i) => expect(keys[i]).toBe(`k${id[0]}`)); // the tag names the key that started it
  });

  it("reads and cancels a run with the key that started it", async () => {
    vi.stubEnv("TINYFISH_API_KEYS", "k0,k1,k2");
    fetchMock.mockResolvedValue(json({ status: "RUNNING", started_at: null }));
    await getRun("2~abc");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/runs\/abc$/);
    expect(keyOf(fetchMock.mock.calls[0])).toBe("k2");
    await cancelRun("1~xyz");
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/runs\/xyz\/cancel$/);
    expect(keyOf(fetchMock.mock.calls[1])).toBe("k1");
    expect(splitRunId("plain-id")).toEqual({ key: 0, id: "plain-id" });
    expect(splitRunId("3~a~b")).toEqual({ key: 3, id: "a~b" });
  });

  it("tries the next key when one is out of credits or rate limited, and gives up when all are", async () => {
    vi.stubEnv("TINYFISH_API_KEYS", "k0,k1");
    fetchMock.mockImplementation(async (_url, init) =>
      (init?.headers as Record<string, string>)["X-API-Key"] === "k0" ? json({}, 402) : json({ run_id: "ok", error: null }),
    );
    const out = await startAgent(params);
    expect(out.status === "started" && out.runId.endsWith("~ok")).toBe(true);
    const keysTried = fetchMock.mock.calls.map(keyOf);
    expect(keysTried).toContain("k1");

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json({}, 429));
    expect(await startAgent(params)).toEqual({ status: "error", error: "http_429" });
    expect(fetchMock).toHaveBeenCalledTimes(2); // one try per key, no more
  });

  it("does not retry other errors", async () => {
    vi.stubEnv("TINYFISH_API_KEYS", "k0,k1");
    fetchMock.mockResolvedValue(json({}, 500));
    expect(await startAgent(params)).toEqual({ status: "error", error: "http_500" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
