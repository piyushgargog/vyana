import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { firstRow } from "@/lib/server/rpc";

describe("firstRow", () => {
  it("takes the first element of an array answer", () => {
    expect(firstRow([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });

  it("takes a bare object answer as the row", () => {
    expect(firstRow({ id: 1 })).toEqual({ id: 1 });
  });

  it("returns null for an empty array", () => {
    expect(firstRow([])).toBeNull();
  });

  it("returns null when there is no answer", () => {
    expect(firstRow(null)).toBeNull();
    expect(firstRow(undefined)).toBeNull();
  });

  it("returns null when the first element is not a row", () => {
    expect(firstRow(["not a row"])).toBeNull();
    expect(firstRow(42)).toBeNull();
  });
});
