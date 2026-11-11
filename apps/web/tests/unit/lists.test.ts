import { describe, expect, it } from "vitest";
import { splitCommaList } from "@/lib/server/lists";

describe("splitCommaList", () => {
  it("splits on commas and trims each entry", () => {
    expect(splitCommaList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("drops empty entries", () => {
    expect(splitCommaList("a,, ,b,")).toEqual(["a", "b"]);
  });

  it("returns an empty list for an unset or blank value", () => {
    expect(splitCommaList(undefined)).toEqual([]);
    expect(splitCommaList("   ")).toEqual([]);
  });
});
