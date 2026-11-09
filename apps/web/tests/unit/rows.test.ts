import { describe, expect, it } from "vitest";
import { readRows } from "@/lib/server/rows";

describe("readRows", () => {
  it("returns the rows typed, and empty when nothing came back", async () => {
    await expect(readRows<{ name: string }>(Promise.resolve({ data: [{ name: "A" }], error: null }))).resolves.toEqual([
      { name: "A" },
    ]);
    await expect(readRows<{ name: string }>(Promise.resolve({ data: null, error: null }))).resolves.toEqual([]);
  });

  it("throws the query error", async () => {
    const error = new Error("boom");
    await expect(readRows(Promise.resolve({ data: null, error }))).rejects.toBe(error);
  });
});
