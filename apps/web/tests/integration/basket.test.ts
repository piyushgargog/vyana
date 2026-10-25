import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, BasketCompareRes } from "@vyana/shared";
import { OTHER_TOKEN, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/prescriptions/basket/route");
const { GET } = await import("@/app/api/prescriptions/basket/[job_id]/route");

const post = (body: unknown, token: string | null = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/prescriptions/basket", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    undefined,
  );

const get = (jobId: string, token = VALID_TOKEN) =>
  GET(new Request(`http://localhost/api/prescriptions/basket/${jobId}`, { headers: { authorization: `Bearer ${token}` } }), {
    params: Promise.resolve({ job_id: jobId }),
  });

const ITEMS = [
  { medicine: "Dolo", strength: "650 mg" },
  { medicine: "Telma", strength: "40 mg", quantity: 2 },
];

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("JOB_TOKEN_SECRET", "x".repeat(48));
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("basket job (mock mode, no network)", () => {
  it("starts a job, then reports verified baskets from every pharmacy", async () => {
    const start = BasketCompareRes.parse(await (await post({ items: ITEMS })).json());
    expect(start.status).toBe("running");
    expect(start.cached).toBe(false);
    expect(start.baskets.map((b) => b.status)).toEqual(["pending", "pending", "pending", "pending"]);
    expect(start.job_id).not.toContain("Dolo");

    const res = await get(start.job_id);
    expect(res.status).toBe(200);
    const done = BasketCompareRes.parse(await res.json());
    expect(done.status).toBe("done");
    expect(done.baskets).toHaveLength(4);
    for (const b of done.baskets) {
      expect(b.status).toBe("ok");
      expect(b.lines.every((l) => l.price_verified)).toBe(true);
      expect(b.lines[1].line_total).toBe((b.lines[1].unit_price as number) * 2);
    }
    const totals = done.baskets.map((b) => b.total as number);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(done.cheapest_source).toBe(done.baskets[0].source);
    expect(done.savings_vs_highest).toBe(Math.round((Math.max(...totals) - Math.min(...totals)) * 100) / 100);
    expect(done.generic).toBeNull();
  });

  it("serves the same basket from cache, typed differently", async () => {
    const start = BasketCompareRes.parse(await (await post({ items: ITEMS })).json());
    await get(start.job_id);
    const again = BasketCompareRes.parse(
      await (await post({ items: [{ medicine: " telma", strength: "40 MG", quantity: 2 }, { medicine: "DOLO", strength: "650 mg" }] })).json(),
    );
    expect(again.status).toBe("done");
    expect(again.cached).toBe(true);
    expect(again.baskets.every((b) => b.status === "ok")).toBe(true);
    // The cached job id can be polled too.
    expect(BasketCompareRes.parse(await (await get(again.job_id)).json()).cached).toBe(true);
  });

  it("prices a prescription's active items", async () => {
    db.prescription_items.push(
      { prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", medicine_name: "Dolo", strength: "650 mg", active: true },
      { prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", medicine_name: "Old med", strength: null, active: false },
    );
    const start = BasketCompareRes.parse(await (await post({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4" })).json());
    const done = BasketCompareRes.parse(await (await get(start.job_id)).json());
    expect(done.baskets[0].lines.map((l) => l.medicine)).toEqual(["Dolo"]);
  });

  it("refuses a prescription with more active medicines than a basket can price, instead of silently dropping some", async () => {
    for (let i = 0; i < 11; i++) {
      db.prescription_items.push({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", medicine_name: `Med ${i + 1}`, strength: null, active: true });
    }
    const res = await post({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4" });
    expect(res.status).toBe(400);
    expect(ApiErrorBody.parse(await res.json()).error.code).toBe("BAD_REQUEST");
  });

  it("returns 404 for a prescription with no active items", async () => {
    const res = await post({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4" });
    expect(res.status).toBe(404);
  });

  it("hides one user's job from another user", async () => {
    const start = BasketCompareRes.parse(await (await post({ items: ITEMS })).json());
    const res = await get(start.job_id, OTHER_TOKEN);
    expect(res.status).toBe(404);
    expect(ApiErrorBody.parse(await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("rejects a forged or altered job id with 404", async () => {
    const start = BasketCompareRes.parse(await (await post({ items: ITEMS })).json());
    expect((await get(start.job_id.slice(0, -3) + "abc")).status).toBe(404);
    expect((await get("v1.forged")).status).toBe(404);
  });

  it("requires a signed-in user", async () => {
    expect((await post({ items: ITEMS }, null)).status).toBe(401);
  });

  it("rejects a bad body with 400", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ items: [] })).status).toBe(400);
    expect((await post("{oops")).status).toBe(400);
    expect((await post({ items: Array.from({ length: 11 }, () => ({ medicine: "Dolo" })) })).status).toBe(400);
  });
});
