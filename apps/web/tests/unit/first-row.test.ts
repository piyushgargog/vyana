import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { firstRow } from "@/lib/server/first-row";

describe("firstRow", () => {
  it("takes the first entry of a list answer", () => {
    expect(firstRow([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
  });

  it("passes a single-object answer through", () => {
    expect(firstRow({ id: "a" })).toEqual({ id: "a" });
  });

  it("gives null for an empty list, a missing answer and non-object answers", () => {
    expect(firstRow([])).toBeNull();
    expect(firstRow(null)).toBeNull();
    expect(firstRow(undefined)).toBeNull();
    expect(firstRow("row")).toBeNull();
    expect(firstRow(7)).toBeNull();
  });
});
