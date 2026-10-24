import { describe, expect, it } from "vitest";

import { cleanInlineText, normalizeName, normalizeNameCompact } from "./clean";

describe("cleanInlineText", () => {
  it("collapses whitespace, trims and caps the length", () => {
    expect(cleanInlineText("  metformin   500mg\n", 80)).toBe("metformin 500mg");
    expect(cleanInlineText("x".repeat(200), 80)).toHaveLength(80);
  });

  it("treats null and undefined as empty", () => {
    expect(cleanInlineText(null, 80)).toBe("");
    expect(cleanInlineText(undefined, 80)).toBe("");
  });

  it("normalizes names the same way for every caller", () => {
    // NFKC folds fullwidth letters, case and whitespace collapse to one space.
    expect(normalizeName("  Ｇｅｎｅｒａｌ   Medicine\n")).toBe("general medicine");
    expect(normalizeName("Dolo   650")).toBe("dolo 650");
    expect(normalizeName("")).toBe("");
  });

  it("compacts names by dropping all whitespace", () => {
    expect(normalizeNameCompact("General   Medicine")).toBe("generalmedicine");
    // The compact form is the base normalizer with spaces removed, so a
    // fullwidth name matches its plain spelling (this is the NFKC gain for
    // the assistant guard, whose old helper skipped NFKC).
    expect(normalizeNameCompact("Ｇｅｎｅｒａｌ Medicine")).toBe(normalizeNameCompact("general medicine"));
  });

  it("stays capped and fast on hostile input", () => {
    for (const hostile of [" ".repeat(100_000), "x".repeat(100_000)]) {
      const started = performance.now();
      const result = cleanInlineText(hostile, 80);
      expect(performance.now() - started).toBeLessThan(500);
      expect(result.length).toBeLessThanOrEqual(80);
    }
  });
});
