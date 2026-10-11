import type { ReportAnalyzeRes } from "../contracts";

export const reportsAnalyzeMock: ReportAnalyzeRes = {
  report_id: "4ded6aec-b8b3-46f6-8fef-cb9c37420497",
  lab_name: "Sample Diagnostics",
  report_date: "2026-10-10",
  summary:
    "Your HbA1c is 7.4%, above the usual target of under 5.7%, which means your average blood sugar over the last three months has been high. It has come down from 8.1% in your previous report. Fasting glucose is also above the normal range. Your kidney and cholesterol values are within range. Discuss these results with your doctor.",
  values: [
    { test_name: "HbA1c", value: 7.4, value_text: null, unit: "%", ref_low: 4, ref_high: 5.6, flag: "high" },
    { test_name: "Fasting Blood Glucose", value: 138, value_text: null, unit: "mg/dL", ref_low: 70, ref_high: 100, flag: "high" },
    { test_name: "Serum Creatinine", value: 0.9, value_text: null, unit: "mg/dL", ref_low: 0.7, ref_high: 1.3, flag: "normal" },
    { test_name: "LDL Cholesterol", value: 96, value_text: null, unit: "mg/dL", ref_low: null, ref_high: 100, flag: "normal" },
    { test_name: "Urine Microalbumin", value: null, value_text: "Negative", unit: null, ref_low: null, ref_high: null, flag: "unknown" },
  ],
  follow_up_tests: ["HbA1c", "Lipid Profile"],
};
