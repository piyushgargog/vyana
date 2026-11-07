import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the `web_cache` table (same shape as cache.test.ts).
const rows = new Map<string, { payload: unknown; expires_at: string }>();

vi.mock("@/lib/server/supabase-admin", () => ({
  requireEnv: (name: string) => process.env[name] ?? "",
  supabaseAdmin: () => ({
    from: () => {
      const q = { key: "", now: "" };
      const chain = {
        select: () => chain,
        eq: (_col: string, key: string) => ((q.key = key), chain),
        gt: (_col: string, now: string) => ((q.now = now), chain),
        maybeSingle: async () => {
          const row = rows.get(q.key);
          return { data: row && row.expires_at > q.now ? { payload: row.payload } : null, error: null };
        },
        upsert: async (row: { key: string; payload: unknown; expires_at: string }) => {
          rows.set(row.key, { payload: row.payload, expires_at: row.expires_at });
          return { error: null };
        },
      };
      return chain;
    },
  }),
}));

const { startBloodJob, pollBloodJob } = await import("@/lib/server/blood");

const stockRow = [
  "1",
  "Test Blood Centre<br/>1 Road, Delhi<br/>Phone: 9000000001",
  "Govt.",
  "Available, O+Ve:5",
  "2026-11-07 10:00:00",
];

const fetchCalls: string[] = [];

beforeEach(() => {
  // The house pattern for the job token in tests (jobs.test.ts, integration/blood.test.ts):
  // a repeated character, never a literal that reads like a credential.
  vi.stubEnv("JOB_TOKEN_SECRET", "x".repeat(40));
  rows.clear();
  fetchCalls.length = 0;
  vi.stubGlobal(
    "fetch",
    async (url: string) => {
      fetchCalls.push(url);
      let body: unknown;
      if (url.includes("GETSTATELIST")) body = [{ value: "97", label: "Delhi" }];
      else if (url.includes("GETDISTRICTLIST")) body = { records: [{ id: "Central Delhi", value: "1" }] };
      else if (url.includes("GETNEARBYSTOCKDETAILS")) body = { data: [stockRow] };
      else throw new Error(`unexpected fetch ${url}`);
      return { ok: true, text: async () => JSON.stringify(body) };
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("blood poll cached flag", () => {
  it("starts uncached, polls cached from the area cache, and says miss once the cache is gone", async () => {
    const req = { blood_group: "O+" as const, component: "whole_blood" as const, city: "Delhi" };
    const started = await startBloodJob("user-1", req);
    expect(started.cached).toBe(false);
    expect(started.banks).toHaveLength(1);

    const stockFetches = fetchCalls.filter((u) => u.includes("GETNEARBYSTOCKDETAILS")).length;
    const polled = await pollBloodJob("user-1", started.job_id);
    expect(polled.cached).toBe(true);
    expect(polled.banks).toEqual(started.banks);
    expect(fetchCalls.filter((u) => u.includes("GETNEARBYSTOCKDETAILS")).length).toBe(stockFetches);

    rows.clear();
    const refetched = await pollBloodJob("user-1", started.job_id);
    expect(refetched.cached).toBe(false);
    // Same bank, freshly read: only fetched_at moves.
    expect(refetched.banks.map(({ fetched_at: _at, ...b }) => b)).toEqual(started.banks.map(({ fetched_at: _at, ...b }) => b));
    expect(fetchCalls.filter((u) => u.includes("GETNEARBYSTOCKDETAILS")).length).toBeGreaterThan(stockFetches);
  });
});
