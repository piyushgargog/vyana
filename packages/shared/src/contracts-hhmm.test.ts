import { describe, expect, it } from "vitest";

import { HhMmPattern, PrescriptionItem } from "./contracts";

const item = (times: string[]) => ({
  id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4",
  medicine_name: "Metformin",
  strength: "500 mg",
  form: "tablet",
  dose: "1 tablet",
  frequency: "BD",
  times,
  with_food: "after",
  duration_days: 30,
  start_date: "2026-10-12",
  end_date: "2026-11-10",
  instructions: null,
});

describe("HhMmPattern", () => {
  it("accepts real 24h times", () => {
    for (const t of ["00:00", "09:00", "21:00", "23:59"]) expect(HhMmPattern.test(t)).toBe(true);
  });

  it("rejects out of range and malformed times", () => {
    for (const t of ["24:00", "25:00", "09:60", "99:99", "9:00", "09:0"]) {
      expect(HhMmPattern.test(t)).toBe(false);
    }
  });
});

describe("PrescriptionItem times", () => {
  it("accepts real times", () => {
    expect(PrescriptionItem.safeParse(item(["09:00", "21:00"])).success).toBe(true);
  });

  it("rejects out of range times at the contract", () => {
    for (const times of [["99:99"], ["25:00"], ["09:60"]]) {
      expect(PrescriptionItem.safeParse(item(times)).success).toBe(false);
    }
  });
});
