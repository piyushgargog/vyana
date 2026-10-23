import { describe, expect, it } from "vitest";

import { cleanInlineText } from "./clean";

describe("cleanInlineText", () => {
  it("collapses whitespace, trims and caps the length", () => {
    expect(cleanInlineText("  metformin   500mg\n", 80)).toBe("metformin 500mg");
    expect(cleanInlineText("x".repeat(200), 80)).toHaveLength(80);
  });

  it("treats null and undefined as empty", () => {
    expect(cleanInlineText(null, 80)).toBe("");
    expect(cleanInlineText(undefined, 80)).toBe("");
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
