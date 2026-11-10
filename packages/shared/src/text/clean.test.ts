import { describe, expect, it } from "vitest";

import { cleanInlineText, normalizeName } from "./clean";

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

describe("normalizeName", () => {
  it("strips all whitespace and folds case and compatibility characters by default", () => {
    expect(normalizeName("  Cardiology ")).toBe("cardiology");
    expect(normalizeName("General  Medicine")).toBe("generalmedicine");
    expect(normalizeName("Ｃａｒｄｉｏｌｏｇｙ")).toBe("cardiology");
    expect(normalizeName("Metformin\t500 mg\n")).toBe("metformin500mg");
  });

  it("keeps single spaces with collapse, so spaced names stay distinct from joined ones", () => {
    expect(normalizeName("  New   Delhi ", "collapse")).toBe("new delhi");
    expect(normalizeName("new delhi", "collapse")).not.toBe(normalizeName("newdelhi", "collapse"));
    expect(normalizeName("Ｄｏｌｏ   650", "collapse")).toBe("dolo 650");
  });
});
