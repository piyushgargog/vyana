import type { LabValueCorrectRes } from "../contracts";

// Mock data for building the UI: the server recomputes the flag from the report's range.
export const labValueCorrectMock: LabValueCorrectRes = {
  report_id: "4ded6aec-b8b3-46f6-8fef-cb9c37420497",
  value: {
    id: "7c1d6f0e-2a4b-4c8d-9e3f-5a6b7c8d9e01",
    test_name: "HbA1c",
    value: 7.1,
    value_text: null,
    unit: "%",
    ref_low: 4,
    ref_high: 5.6,
    flag: "high",
    needs_review: false,
    corrected: true,
  },
  summary: "2 of 5 values are outside their reference range: HbA1c, Fasting Blood Glucose. Please discuss these results with your doctor.",
  follow_up_tests: ["HbA1c", "Fasting Blood Glucose"],
};
