import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, BloodSearchRes } from "@vyana/shared";
import { OTHER_TOKEN, VALID_TOKEN, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/blood/search/route");
const { GET } = await import("@/app/api/blood/search/[job_id]/route");
const { processBloodResult, summarizeBlood } = await import("@/lib/server/tinyfish/blood");
const { bloodAreas } = await import("@/lib/server/tinyfish/sources");

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

const search = { blood_group: "B-", component: "red_cells", city: "Delhi" };

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("JOB_TOKEN_SECRET", "x".repeat(40));
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/blood/search + GET /{job_id}", () => {
  it("starts one agent per area, then returns the rows with verified ones first", async () => {
    const res = await start(search);
    expect(res.status).toBe(200);
    const started = BloodSearchRes.parse(await res.json());
    expect(started).toMatchObject({ status: "running", area: "Delhi", banks: [], cached: false });
    expect(started.sources).toEqual(["Delhi", "Gurugram", "Noida", "Ghaziabad"].map((area) => ({ area, status: "pending" })));

    const done = BloodSearchRes.parse(await (await poll(started.job_id)).json());
    expect(done.status).toBe("done");
    expect(done.banks).toHaveLength(8);
    expect(done.banks.every((b) => b.verified && b.name.startsWith("[mock]"))).toBe(true);
    expect(done.banks.map((b) => b.units)).toEqual([4, 4, 4, 4, 0, 0, 0, 0]);

    const again = BloodSearchRes.parse(await (await start({ ...search, city: " delhi " })).json());
    expect(again).toMatchObject({ status: "done", cached: true });
  });

  it("keeps a job private to the user who started it", async () => {
    const started = BloodSearchRes.parse(await (await start(search)).json());
    const res = await poll(started.job_id, OTHER_TOKEN);
    expect(res.status).toBe(404);
    expect(ApiErrorBody.parse(await res.json()).error.message).toContain("not found");
  });

  it("needs a signed-in user and a valid blood group, component and city", async () => {
    expect((await start(search, "")).status).toBe(401);
    expect((await start({ ...search, blood_group: "C+" })).status).toBe(400);
    expect((await start({ ...search, component: "milk" })).status).toBe(400);
    expect((await start({ ...search, city: "D" })).status).toBe(400);
  });
});

describe("processBloodResult / summarizeBlood / bloodAreas", () => {
  const row = (over: Record<string, unknown> = {}) => ({ name: "City Blood Bank", phone: "011 2222 3333", units: 5, units_text: "5", component: "Whole Blood", updated: "21-10-2026 09:10", row_text: "City Blood Bank 011 2222 3333 5 Whole Blood", ...over });

  it("verifies a row only when the stock cell reads as the number and the copied row holds the name and the cell", () => {
    const out = processBloodResult("Delhi", { found: true, banks: [row(), row({ name: "No Text Bank", phone: "1", row_text: null }), row({ name: "Wrong Units Bank", phone: "2", row_text: "Wrong Units Bank 9" })] });
    expect(out.status).toBe("ok");
    expect(out.banks.map((b) => [b.name, b.verified])).toEqual([["City Blood Bank", true], ["No Text Bank", false], ["Wrong Units Bank", false]]);
  });

  it("does not take 15 for 5, and ignores an impossible or fractional unit count", () => {
    const out = processBloodResult("Delhi", { found: true, banks: [row({ units: 5, units_text: "15", row_text: "City Blood Bank 15" }), row({ name: "B", phone: "2", units: 5000, units_text: "5000", row_text: "B 5000" }), row({ name: "C", phone: "3", units: 2.5, units_text: "2.5", row_text: "C 2.5" })] });
    expect(out.banks.map((b) => [b.units, b.verified])).toEqual([[5, false], [null, false], [null, false]]);
  });

  it("a stray number in the row is not a confirmation: without the stock cell nothing is verified", () => {
    const out = processBloodResult("Delhi", { found: true, banks: [row({ name: "Block 1 Bank", phone: "7", units: 1, units_text: null, row_text: "Block 1 Bank 1" }), row({ name: "Gate 2 Bank", phone: "8", units: 2, units_text: "2", row_text: "Gate 2 Bank 2" })] });
    expect(out.banks.map((b) => [b.name, b.verified])).toEqual([["Block 1 Bank", false], ["Gate 2 Bank", true]]);
  });

  it("drops duplicates, a missing name, found=false and a bad shape", () => {
    expect(processBloodResult("Delhi", { found: true, banks: [row(), row(), row({ name: "  " })] }).banks).toHaveLength(1);
    expect(processBloodResult("Delhi", { found: false, banks: [row()] })).toEqual({ status: "not_found", banks: [] });
    expect(processBloodResult("Delhi", { banks: "none" })).toEqual({ status: "error", banks: [] });
    expect(processBloodResult("Delhi", null).status).toBe("error");
  });

  it("puts verified rows first, then more units, and the job is running while an area is pending", () => {
    const bank = (name: string, units: number | null, verified: boolean) => processBloodResult("X", { found: true, banks: [{ name, units, units_text: verified ? String(units) : null, row_text: verified ? `${name} ${units}` : null }] }).banks[0];
    const s = summarizeBlood([
      { area: "A", status: "ok", banks: [bank("low", 1, true), bank("unconfirmed", 50, false)] },
      { area: "B", status: "ok", banks: [bank("high", 9, true)] },
      { area: "C", status: "pending", banks: [] },
    ]);
    expect(s.banks.map((b) => b.name)).toEqual(["high", "low", "unconfirmed"]);
    expect(s.status).toBe("running");
  });

  it("searches the city and up to three nearby ones", () => {
    expect(bloodAreas("Delhi")).toEqual(["Delhi", "Gurugram", "Noida", "Ghaziabad"]);
    expect(bloodAreas("Jaipur")).toEqual(["Jaipur"]);
  });
});
