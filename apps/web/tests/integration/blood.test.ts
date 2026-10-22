import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, BloodSearchRes } from "@vyana/shared";
import { OTHER_TOKEN, VALID_TOKEN, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";
import { fakeERaktKosh } from "../fixtures/eraktkosh";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/blood/search/route");
const { GET } = await import("@/app/api/blood/search/[job_id]/route");
const { bloodAreas } = await import("@/lib/server/blood");

const start = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/blood/search", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );
const poll = (jobId: string, token = VALID_TOKEN) =>
  GET(new Request(`http://localhost/api/blood/search/${jobId}`, { headers: { authorization: `Bearer ${token}` } }), {
    params: Promise.resolve({ job_id: jobId }),
  } as never);

const search = { blood_group: "B-", component: "whole_blood", city: "Delhi" };
let source: ReturnType<typeof fakeERaktKosh>;

beforeEach(() => {
  vi.stubEnv("JOB_TOKEN_SECRET", "x".repeat(40));
  resetDb();
  source = fakeERaktKosh();
  vi.stubGlobal("fetch", vi.fn(source.fetchFn));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/blood/search + GET /{job_id}", () => {
  it("reads the stock directly and returns the rows with the most units first, finished at once", async () => {
    const res = await start(search);
    expect(res.status).toBe(200);
    const body = BloodSearchRes.parse(await res.json());
    expect(body).toMatchObject({ status: "done", area: "Delhi", cached: false });
    // 3 rows in the fixture have a stock number; "Not Available" and the 99,999 misread are dropped
    expect(body.banks.map((b) => [b.name, b.units])).toEqual([
      ["Fictional Medical College", 16],
      ["A & B Blood Bank", 7],
      ["Test Hospital Blood Centre", 5],
      ["Dummy Institute", 2],
    ]);
    expect(body.banks.every((b) => b.verified && b.source_url.startsWith("https://eraktkosh.mohfw.gov.in/"))).toBe(true);
    expect(body.banks[0]).toMatchObject({ phone: "011-2000002", last_updated_text: null, component: "Whole Blood" });
    expect(body.sources.map((s) => s.status)).toContain("ok");
  });

  it("asks the source politely: its own page's parameters, a User-Agent, and each answer once (cached)", async () => {
    await start(search);
    const stockCalls = source.calls.filter((u) => u.includes("GETNEARBYSTOCKDETAILS"));
    expect(stockCalls.length).toBeGreaterThan(0);
    expect(stockCalls[0]).toContain("stateCode=97");
    expect(stockCalls[0]).toContain("bloodGroup=14");
    expect(stockCalls[0]).toContain("bloodComponent=11");
    const calls = source.calls.length;
    await start({ ...search, city: " delhi " });
    expect(source.calls.length).toBe(calls); // the second search came from the cache
    const init = (fetch as unknown as { mock: { calls: [unknown, RequestInit][] } }).mock.calls[0]?.[1];
    expect(String((init?.headers as Record<string, string>)["User-Agent"])).toContain("Vyana");
  });

  it("answers the poll route from the same data, and keeps a job private to the user who started it", async () => {
    const started = BloodSearchRes.parse(await (await start(search)).json());
    const again = BloodSearchRes.parse(await (await poll(started.job_id)).json());
    expect(again.banks).toEqual(started.banks);
    const res = await poll(started.job_id, OTHER_TOKEN);
    expect(res.status).toBe(404);
    expect(ApiErrorBody.parse(await res.json()).error.message).toContain("not found");
  });

  it("says not_found for a city the source has no district for, and error when the source fails", async () => {
    const unknown = BloodSearchRes.parse(await (await start({ ...search, city: "Atlantis" })).json());
    expect(unknown).toMatchObject({ banks: [], status: "done", sources: [{ area: "Atlantis", status: "not_found" }] });

    resetDb();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    const down = BloodSearchRes.parse(await (await start(search)).json());
    expect(down.banks).toEqual([]);
    expect(down.sources.every((s) => s.status === "error" || s.status === "not_found")).toBe(true);
  });

  it("needs a signed-in user and a valid blood group, component and city", async () => {
    expect((await start(search, "")).status).toBe(401);
    expect((await start({ ...search, blood_group: "C+" })).status).toBe(400);
    expect((await start({ ...search, component: "milk" })).status).toBe(400);
    expect((await start({ ...search, city: "D" })).status).toBe(400);
  });
});

describe("areas", () => {
  it("searches the city and its nearby cities, each matched to a district of the source", async () => {
    const areas = await bloodAreas("Delhi");
    expect(areas.map((a) => a.label)).toEqual(["Delhi", "Gurgaon, Haryana", "Gautam Buddha Nagar, Uttar Pradesh", "Ghaziabad, Uttar Pradesh"]);
    expect(areas[0]).toMatchObject({ stateCode: "97", districtCode: "-1" });
  });

  it("knows the new names of cities, and a district typed in part", async () => {
    expect((await bloodAreas("Gurugram"))[0]?.label).toBe("Gurgaon, Haryana");
    expect((await bloodAreas("pune"))[0]).toMatchObject({ label: "Pune, Maharashtra", districtCode: "31" });
    expect(await bloodAreas("Atlantis")).toEqual([]);
  });
});
