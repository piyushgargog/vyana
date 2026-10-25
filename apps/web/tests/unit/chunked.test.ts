import { describe, expect, it } from "vitest";
import { readChunked } from "@/lib/server/chunked";

describe("readChunked", () => {
  it("joins rows across chunks of 100 ids", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const seen: string[][] = [];
    const rows = await readChunked(ids, async (part) => {
      seen.push(part);
      return { data: part.map((id) => ({ id })), error: null };
    });
    expect(seen).toHaveLength(3);
    expect(seen.map((part) => part.length)).toEqual([100, 100, 50]);
    expect(rows).toHaveLength(250);
    expect(rows[249]).toEqual({ id: "id-249" });
  });

  it("returns an empty list without querying", async () => {
    const calls: string[][] = [];
    const rows = await readChunked([], async (part) => {
      calls.push(part);
      return { data: [], error: null };
    });
    expect(calls).toHaveLength(0);
    expect(rows).toEqual([]);
  });

  it("throws when a chunk fails and treats null data as empty", async () => {
    const failure = new Error("db down");
    await expect(
      readChunked(["a", "b"], async (part) => (part.includes("b") ? { data: null, error: failure } : { data: [{ id: "a" }], error: null })),
    ).rejects.toThrow("db down");
    const rows = await readChunked(["a"], async () => ({ data: null, error: null }));
    expect(rows).toEqual([]);
  });
});
