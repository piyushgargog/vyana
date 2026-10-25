import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, LabsCompareRes } from "@vyana/shared";
import { OTHER_TOKEN, VALID_TOKEN, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/labs/compare/route");
const { GET } = await import("@/app/api/labs/compare/[job_id]/route");
const { processLabResult, summarizeLabs } = await import("@/lib/server/tinyfish/labs");
const { registerMockPage } = await import("@/lib/server/tinyfish/fixtures");
const { LABS } = await import("@/lib/server/tinyfish/sources");

const start = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/labs/compare", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );
const poll = (jobId: string, token = VALID_TOKEN) =>
  GET(new Request(`http://localhost/api/labs/compare/${jobId}`, { headers: { authorization: `Bearer ${token}` } }), {
    params: Promise.resolve({ job_id: jobId }),
  } as never);

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("JOB_TOKEN_SECRET", "x".repeat(40));
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/labs/compare + GET /{job_id}", () => {
  it("starts one agent per lab, then returns verified prices with the cheapest", async () => {
    const res = await start({ test_name: "HbA1c", city: "Delhi" });
    expect(res.status).toBe(200);
    const started = LabsCompareRes.parse(await res.json());
    expect(started).toMatchObject({ status: "running", city: "Delhi", quotes: [], cheapest: null, cached: false });
    expect(started.sources.map((s) => [s.source, s.status])).toEqual([
      ["healthians", "pending"],
      ["redcliffe", "pending"],
      ["thyrocare", "pending"],
      ["1mg_labs", "pending"],
    ]);

    const done = LabsCompareRes.parse(await (await poll(started.job_id)).json());
    expect(done.status).toBe("done");
    expect(done.quotes).toHaveLength(4);
    expect(done.quotes.every((q) => q.price_verified && q.kind === "lab_test")).toBe(true);
    expect(done.quotes.map((q) => q.price)).toEqual([280, 290, 290, 300]);
    expect(done.cheapest).toMatchObject({ source: "1mg_labs", price: 280 });

    const again = LabsCompareRes.parse(await (await start({ test_name: "hba1c", city: " delhi " })).json());
    expect(again).toMatchObject({ status: "done", cached: true });
  });

  it("keeps a job private to the user who started it", async () => {
    const started = LabsCompareRes.parse(await (await start({ test_name: "TSH", city: "Delhi" })).json());
    const res = await poll(started.job_id, OTHER_TOKEN);
    expect(res.status).toBe(404);
    expect(ApiErrorBody.parse(await res.json()).error.message).toContain("not found");
  });

  it("needs a signed-in user and a test and city", async () => {
    expect((await start({ test_name: "TSH", city: "Delhi" }, "")).status).toBe(401);
    expect((await start({ test_name: "T", city: "Delhi" })).status).toBe(400);
  });
});

describe("processLabResult / summarizeLabs", () => {
  const lab = LABS.find((l) => l.source === "redcliffe")!;
  const start = "https://redcliffelabs.com/delhi/tests/hba1c-test";

  it("drops a page off the lab's site and an unbelievable price; a price not on the page is unverified", async () => {
    expect((await processLabResult(lab, "HbA1c", "Delhi", start, { found: true, price: 299, test_url: "https://cheap.example/hba1c" })).status).toBe("not_found");
    const zero = await processLabResult(lab, "HbA1c", "Delhi", start, { found: true, price: 0, test_url: start });
    expect(zero.quote).toMatchObject({ price: null, price_verified: false });
    registerMockPage(start, "# HbA1c Test in Delhi\n\nPrice ₹349");
    const off = await processLabResult(lab, "HbA1c", "Delhi", start, { found: true, test_name: "HbA1c", price: 299, test_url: start });
    expect(off.quote).toMatchObject({ price: 299, price_verified: false });
    const on = await processLabResult(lab, "HbA1c", "Delhi", start, { found: true, test_name: "HbA1c", price: 349, test_url: "/delhi/tests/hba1c-test" });
    expect(on.quote).toMatchObject({ price: 349, price_verified: true, product_url: start });
  });

  it("puts verified prices first and never picks an unverified one as cheapest", () => {
    const q = (source: "healthians" | "thyrocare", price: number, price_verified: boolean) =>
      ({ kind: "lab_test", query: "q", source, product_name: "x", pack_size: null, price, mrp: null, in_stock: null, product_url: "u", fetched_at: "t", price_verified }) as const;
    const s = summarizeLabs([
      { source: "thyrocare", status: "ok", quote: q("thyrocare", 199, false) },
      { source: "healthians", status: "ok", quote: q("healthians", 349, true) },
    ]);
    expect(s.quotes.map((x) => x.source)).toEqual(["healthians", "thyrocare"]);
    expect(s.cheapest?.source).toBe("healthians");
  });
});
