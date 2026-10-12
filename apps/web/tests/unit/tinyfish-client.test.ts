import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/server/errors";
import {
  AGENT_CALLS_PER_MINUTE,
  createSearchMonitor,
  deleteMonitor,
  fetchPages,
  resetCreditGuard,
  runAgent,
  search,
} from "@/lib/server/tinyfish/client";
import { PHARMACIES, absoluteUrl, isOnDomain } from "@/lib/server/tinyfish/sources";

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function sse(events: unknown[]): Response {
  const text = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}

const lastCall = () => fetchMock.mock.calls.at(-1)!;
const lastBody = () => JSON.parse(String(lastCall()[1]?.body));

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "0");
  vi.stubEnv("TINYFISH_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  resetCreditGuard();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("search", () => {
  const ok = { query: "metformin", results: [{ position: 1, site_name: "medlineplus.gov", title: "Metformin", snippet: "…", url: "https://medlineplus.gov/druginfo/meds/a696005.html" }] };

  it("sends the key and the domain filter as query parameters", async () => {
    fetchMock.mockResolvedValueOnce(json(ok));
    const res = await search({ query: "metformin", include_domains: ["medlineplus.gov", "who.int"], location: "IN" });
    expect(res.results[0].url).toContain("medlineplus.gov");
    const [url, init] = lastCall();
    const u = new URL(String(url));
    expect(u.origin).toBe("https://api.search.tinyfish.ai");
    expect(u.searchParams.get("include_domains")).toBe("medlineplus.gov,who.int");
    expect(u.searchParams.get("location")).toBe("IN");
    expect((init?.headers as Record<string, string>)["X-API-Key"]).toBe("test-key");
  });

  it("retries once on a 5xx and counts both calls", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json(ok));
    const counter = { tinyfishCalls: 0 };
    await search({ query: "metformin" }, { counter });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(counter.tinyfishCalls).toBe(2);
  });

  it("turns an HTTP error into a safe 502", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "bad key" }, 401));
    const err = await search({ query: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(502);
    expect(err.message).not.toContain("key");
  });

  it("rejects a malformed response", async () => {
    fetchMock.mockResolvedValueOnce(json({ nope: true }));
    await expect(search({ query: "x" })).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });
  });

  it("returns fixtures without network calls in mock mode", async () => {
    vi.stubEnv("TINYFISH_MOCK", "1");
    const res = await search({ query: "Dolo 650", include_domains: ["janaushadhi.gov.in"] });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.results[0].url.startsWith("https://janaushadhi.gov.in/")).toBe(true);
    expect(res.results[0].title.startsWith("[mock]")).toBe(true);
  });
});

describe("fetchPages", () => {
  it("posts the URLs and returns per-URL errors without throwing", async () => {
    fetchMock.mockResolvedValueOnce(
      json({
        results: [{ url: "https://a.example", final_url: "https://a.example", title: "A", text: "# A", format: "markdown" }],
        errors: [{ url: "https://b.example", error: "bot_blocked" }],
      }),
    );
    const res = await fetchPages({ urls: ["https://a.example", "https://b.example"], highlights: { query: "paracetamol price" } });
    expect(res.results).toHaveLength(1);
    expect(res.errors[0].error).toBe("bot_blocked");
    expect(lastBody()).toMatchObject({ urls: ["https://a.example", "https://b.example"], format: "markdown", highlights: { query: "paracetamol price" } });
    expect(lastBody().per_url_timeout_ms).toBeLessThan(60_000);
  });

  it("refuses more than 10 URLs", async () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://e.example/${i}`);
    await expect(fetchPages({ urls })).rejects.toThrow("1 to 10");
  });
});

describe("runAgent", () => {
  const params = { url: "https://pharmeasy.in/search/all?name=dolo", goal: "Find Dolo 650" };

  it("returns ok with the parsed result and caps the remote run time", async () => {
    fetchMock.mockResolvedValueOnce(json({ run_id: "r1", status: "COMPLETED", result: { price: 30 } }));
    const out = await runAgent({ ...params, parse: (r) => r as { price: number } }, { timeoutMs: 60_000 });
    expect(out).toEqual({ status: "ok", result: { price: 30 }, runId: "r1" });
    expect(String(lastCall()[0])).toBe("https://agent.tinyfish.ai/v1/automation/run");
    expect(lastBody()).toMatchObject({ url: params.url, goal: params.goal, browser_profile: "lite", agent_config: { max_duration_seconds: 60 } });
  });

  it("maps an empty result to not_found", async () => {
    fetchMock.mockResolvedValueOnce(json({ run_id: "r2", status: "COMPLETED", result: {} }));
    expect((await runAgent(params)).status).toBe("not_found");
  });

  it("maps run failures to timeout or error", async () => {
    fetchMock.mockResolvedValueOnce(json({ run_id: "r3", status: "FAILED", error: { code: "TIMEOUT" } }));
    expect(await runAgent(params)).toMatchObject({ status: "timeout", error: "TIMEOUT" });
    fetchMock.mockResolvedValueOnce(json({ run_id: "r4", status: "FAILED", error: { code: "SITE_BLOCKED" } }));
    expect(await runAgent(params)).toMatchObject({ status: "error", error: "SITE_BLOCKED" });
  });

  it("treats a result that fails validation as an error", async () => {
    fetchMock.mockResolvedValueOnce(json({ run_id: "r5", status: "COMPLETED", result: { price: "free!" } }));
    const out = await runAgent({
      ...params,
      parse: (r) => {
        if (typeof (r as { price: unknown }).price !== "number") throw new Error("bad");
        return r;
      },
    });
    expect(out).toMatchObject({ status: "error", error: "invalid_result" });
  });

  it("returns timeout when our own deadline passes", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("The operation timed out.", "TimeoutError"));
    expect(await runAgent(params)).toMatchObject({ status: "timeout", error: "client_timeout" });
  });

  it("falls back to SSE when the sync endpoint is unavailable and reads the COMPLETE event", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(
      sse([
        { type: "STARTED", run_id: "r6" },
        { type: "PROGRESS", run_id: "r6", purpose: "Searching" },
        { type: "COMPLETE", run_id: "r6", status: "COMPLETED", result: { price: 31 } },
      ]),
    );
    expect(await runAgent(params)).toEqual({ status: "ok", result: { price: 31 }, runId: "r6" });
    expect(String(lastCall()[0])).toBe("https://agent.tinyfish.ai/v1/automation/run-sse");
  });

  it("streams progress over SSE when asked", async () => {
    fetchMock.mockResolvedValueOnce(
      sse([
        { type: "PROGRESS", run_id: "r7", purpose: "Opening PharmEasy" },
        { type: "COMPLETE", run_id: "r7", status: "COMPLETED", result: { price: 29 } },
      ]),
    );
    const progress: string[] = [];
    const out = await runAgent({ ...params, onProgress: (p) => progress.push(p) });
    expect(out.status).toBe("ok");
    expect(progress).toEqual(["Opening PharmEasy"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports a stream that ends without COMPLETE as an error", async () => {
    fetchMock.mockResolvedValueOnce(sse([{ type: "STARTED", run_id: "r8" }]));
    expect(await runAgent({ ...params, onProgress: () => {} })).toMatchObject({ status: "error", error: "stream_ended", runId: "r8" });
  });

  it("stops at the credit guard limit without calling TinyFish", async () => {
    fetchMock.mockImplementation(async () => json({ run_id: "r", status: "COMPLETED", result: { ok: true } }));
    for (let i = 0; i < AGENT_CALLS_PER_MINUTE; i++) expect((await runAgent(params)).status).toBe("ok");
    expect(await runAgent(params)).toMatchObject({ status: "error", error: "credit_guard" });
    expect(fetchMock).toHaveBeenCalledTimes(AGENT_CALLS_PER_MINUTE);
  });

  it("uses the caller's fixture in mock mode", async () => {
    vi.stubEnv("TINYFISH_MOCK", "1");
    expect(await runAgent({ ...params, mockResult: { price: 1 } })).toEqual({ status: "ok", result: { price: 1 }, runId: null });
    expect(await runAgent(params)).toMatchObject({ status: "not_found" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("monitors", () => {
  it("creates a topic monitor and returns its id", async () => {
    fetchMock.mockResolvedValueOnce(json({ monitor: { id: "m1", status: "active" }, run: {} }, 201));
    const res = await createSearchMonitor({ name: "Quality alerts", query: "CDSCO not of standard quality", schedule_cron: "0 */12 * * *", webhook_url: "https://app.example/api/webhooks/tinyfish-monitor?secret=s" });
    expect(res).toEqual({ id: "m1" });
    expect(lastBody()).toMatchObject({ type: "search", config: { query: "CDSCO not of standard quality" }, schedule_cron: "0 */12 * * *" });
  });

  it("deletes a monitor and treats an already-deleted one as done", async () => {
    fetchMock.mockResolvedValueOnce(json({ deleted: true, id: "m1" })).mockResolvedValueOnce(json({}, 404));
    await deleteMonitor("m1");
    await deleteMonitor("m1");
    expect(lastCall()[1]?.method).toBe("DELETE");
    expect(String(lastCall()[0])).toBe("https://agent.tinyfish.ai/v1/monitors/m1");
  });
});

describe("sources", () => {
  it("builds encoded search URLs on each pharmacy's own domain", () => {
    for (const p of PHARMACIES) {
      const url = p.searchUrl("Dolo 650 & co");
      expect(isOnDomain(url, p.domain)).toBe(true);
      expect(url).not.toContain(" ");
    }
  });

  it("resolves a relative product link against the start page", () => {
    const base = "https://www.apollopharmacy.in/search-medicines/dolo%20650";
    expect(absoluteUrl("/otc/dolo-650mg-tablet-15-s", base)).toBe("https://www.apollopharmacy.in/otc/dolo-650mg-tablet-15-s");
    expect(absoluteUrl("https://www.1mg.com/drugs/x", base)).toBe("https://www.1mg.com/drugs/x");
    expect(absoluteUrl("javascript:alert(1)", base)).toBeNull();
    expect(absoluteUrl(null, base)).toBeNull();
  });

  it("accepts subdomains and rejects look-alike hosts", () => {
    expect(isOnDomain("https://www.1mg.com/drugs/dolo-650", "1mg.com")).toBe(true);
    expect(isOnDomain("https://1mg.com.evil.example/x", "1mg.com")).toBe(false);
    expect(isOnDomain("https://not1mg.com/x", "1mg.com")).toBe(false);
    expect(isOnDomain("javascript:alert(1)", "1mg.com")).toBe(false);
  });
});
