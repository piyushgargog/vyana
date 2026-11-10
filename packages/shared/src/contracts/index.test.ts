import { describe, expect, it } from "vitest";

import { HhMmPattern } from "./index";

describe("HhMmPattern", () => {
  it("accepts real 24h times", () => {
    for (const t of ["00:00", "09:00", "23:59"]) expect(HhMmPattern.test(t)).toBe(true);
  });

  it("rejects out of range and malformed times", () => {
    for (const t of ["24:00", "09:60", "99:99", "9:00", "09:0", "09:00 ", " 09:00"]) {
      expect(HhMmPattern.test(t)).toBe(false);
    }
  });
});
