import { describe, expect, it } from "vitest";
import { LabValueCorrectReq } from "@vyana/shared";
import { applyCorrection } from "@/lib/server/reports";

const ID = "7c1d6f0e-2a4b-4c8d-9e3f-5a6b7c8d9e01";
const row = {
  id: ID,
  report_id: "4ded6aec-b8b3-46f6-8fef-cb9c37420497",
  patient_id: "11111111-1111-4111-8111-111111111111",
  test_name: "HbA1c",
  value: 74,
  value_text: null,
  unit: "%",
  ref_low: 4,
  ref_high: 5.6,
  flag: "high" as const,
};

describe("applyCorrection (flag recomputed in code)", () => {
  it("uses the stored range for the new value", () => {
    expect(applyCorrection(row, { value_id: ID, value: 5.2 })).toMatchObject({ value: 5.2, flag: "normal", corrected: true, needs_review: false });
    expect(applyCorrection(row, { value_id: ID, value: 3.1 }).flag).toBe("low");
    expect(applyCorrection(row, { value_id: ID, value: 7.4 }).flag).toBe("high");
  });

  it("keeps the unit unless the patient changes it", () => {
    expect(applyCorrection(row, { value_id: ID, value: 7.4 }).unit).toBe("%");
    expect(applyCorrection(row, { value_id: ID, value: 7.4, unit: "mmol/mol" }).unit).toBe("mmol/mol");
    expect(applyCorrection(row, { value_id: ID, value: 7.4, unit: null }).unit).toBeNull();
  });

  it("a written result has no flag to compute", () => {
    const v = applyCorrection({ ...row, ref_low: null, ref_high: null }, { value_id: ID, value: null, value_text: "Negative" });
    expect(v).toMatchObject({ value: null, value_text: "Negative", flag: "unknown" });
  });

  it("never changes the name or the range", () => {
    const v = applyCorrection(row, { value_id: ID, value: 6 });
    expect([v.test_name, v.ref_low, v.ref_high]).toEqual(["HbA1c", 4, 5.6]);
  });
});

describe("LabValueCorrectReq", () => {
  it("needs a value or a written result", () => {
    expect(LabValueCorrectReq.safeParse({ value_id: ID, value: null }).success).toBe(false);
    expect(LabValueCorrectReq.safeParse({ value_id: ID, value: null, value_text: "  " }).success).toBe(false);
    expect(LabValueCorrectReq.safeParse({ value_id: ID, value: 5 }).success).toBe(true);
    expect(LabValueCorrectReq.safeParse({ value_id: "x", value: 5 }).success).toBe(false);
  });
});
