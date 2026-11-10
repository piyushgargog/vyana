import { describe, expect, it } from "vitest";

import { medicineLabel } from "./medicines";

describe("medicineLabel", () => {
  it("joins name and strength, or returns the name alone", () => {
    expect(medicineLabel({ medicine_name: "Metformin", strength: "500 mg" })).toBe("Metformin 500 mg");
    expect(medicineLabel({ medicine_name: "Metformin", strength: null })).toBe("Metformin");
    expect(medicineLabel({ medicine_name: "Metformin", strength: "" })).toBe("Metformin");
  });
});
