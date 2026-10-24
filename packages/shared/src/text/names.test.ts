import { describe, expect, it } from "vitest";

import { medicineLabel, normaliseTestName } from "./names";

describe("medicineLabel", () => {
  it("joins the name and strength when there is one", () => {
    expect(medicineLabel({ medicine_name: "Metformin", strength: "500mg" })).toBe("Metformin 500mg");
  });

  it("is just the name when there is no strength", () => {
    expect(medicineLabel({ medicine_name: "Metformin", strength: null })).toBe("Metformin");
  });
});

describe("normaliseTestName", () => {
  it("lower-cases and drops spaces and punctuation, so spelling variants compare equal", () => {
    expect(normaliseTestName("HbA1c")).toBe("hba1c");
    expect(normaliseTestName("Hb A1c")).toBe("hba1c");
    expect(normaliseTestName("Glycated Haemoglobin (HbA1c)")).toBe("glycatedhaemoglobinhba1c");
  });

  it("keeps digits and drops nothing else it should keep", () => {
    expect(normaliseTestName("Vitamin D3")).toBe("vitamind3");
    expect(normaliseTestName("")).toBe("");
  });
});
