import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the `web_cache` table.
const rows = new Map<string, { payload: unknown; expires_at: string }>();
const upserts: string[] = [];

vi.mock("@/lib/server/supabase-admin", () => ({
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
          upserts.push(row.key);
          rows.set(row.key, { payload: row.payload, expires_at: row.expires_at });
          return { error: null };
        },
      };
      return chain;
    },
  }),
}));

const { cached, normalizeKeyPart } = await import("@/lib/server/cache");

beforeEach(() => {
  rows.clear();
  upserts.length = 0;
});

describe("cached", () => {
  it("computes on a miss, then serves the stored value", async () => {
    const compute = vi.fn(async () => ({ price: 30 }));
    expect(await cached("med:dolo 650", "medicine", 60, compute)).toEqual({ value: { price: 30 }, cached: false });
    expect(await cached("med:dolo 650", "medicine", 60, compute)).toEqual({ value: { price: 30 }, cached: true });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("never stores a null result", async () => {
    expect(await cached("med:nothing", "medicine", 60, async () => null)).toBeNull();
    expect(upserts).toEqual([]);
  });

  it("recomputes an expired entry", async () => {
    rows.set("med:old", { payload: { price: 1 }, expires_at: new Date(Date.now() - 1000).toISOString() });
    expect(await cached("med:old", "medicine", 60, async () => ({ price: 2 }))).toEqual({ value: { price: 2 }, cached: false });
  });

  it("shares one compute between identical requests in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const compute = vi.fn(async () => {
      await gate;
      return { price: 30 };
    });
    const a = cached("basket:abc", "basket", 60, compute);
    const b = cached("basket:abc", "basket", 60, compute);
    release();
    const [ra, rb] = await Promise.all([a, b]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(ra).toEqual(rb);
  });
});

describe("normalizeKeyPart", () => {
  it("makes the same input typed differently produce one key", () => {
    expect(normalizeKeyPart("  Dolo   650 ")).toBe(normalizeKeyPart("dolo 650"));
  });
});
