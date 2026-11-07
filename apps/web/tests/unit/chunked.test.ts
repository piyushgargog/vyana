import { describe, expect, it } from "vitest";
import { chunks, readChunked } from "@/lib/server/chunked";

describe("chunks", () => {
  it("splits 250 ids into 100, 100 and 50", () => {
    const ids = Array.from({ length: 250 }, (_, i) => "id-" + i);
    const parts = chunks(ids);
    expect(parts.map((p) => p.length)).toEqual([100, 100, 50]);
    expect(parts.flat()).toEqual(ids);
  });

  it("returns no parts for an empty list", () => {
    expect(chunks([])).toEqual([]);
  });
});

describe("readChunked", () => {
  it("queries once per 100 ids and joins the rows in order", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => "id-" + i);
    const seen: string[][] = [];
    const rows = await readChunked<string>(ids, async (part) => {
      seen.push(part);
      return { data: part.map((id) => "row-" + id), error: null };
    });
    expect(seen.map((p) => p.length)).toEqual([100, 100, 50]);
    expect(rows).toEqual(ids.map((id) => "row-" + id));
  });

  it("never calls the query for an empty id list", async () => {
    let calls = 0;
    const rows = await readChunked<string>([], async () => {
      calls += 1;
      return { data: ["x"], error: null };
    });
    expect(calls).toBe(0);
    expect(rows).toEqual([]);
  });

  it("throws the query error instead of returning partial rows", async () => {
    await expect(
      readChunked<string>(["a", "b"], async () => ({ data: null, error: new Error("boom") })),
    ).rejects.toThrow("boom");
  });
});
