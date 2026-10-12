import type { ReportAnalyzeRes } from "../contracts";
import { mockAiMeta } from "./ai-meta";

// Flags follow the reference ranges (computed in code on the server); the summary only restates values.
export const reportsAnalyzeMock: ReportAnalyzeRes = {
  report_id: "4ded6aec-b8b3-46f6-8fef-cb9c37420497",
  lab_name: "Sample Diagnostics",
  report_date: "2026-10-10",
  summary:
    "Your HbA1c is 7.4%, above the reference range of 4.0–5.6%. It was 8.1% in your previous report. Fasting glucose is 138 mg/dL, above the reference range of 70–100 mg/dL. Creatinine and LDL cholesterol are within their ranges. Please discuss these results with your doctor.",
  values: [
    { test_name: "HbA1c", value: 7.4, value_text: null, unit: "%", ref_low: 4, ref_high: 5.6, flag: "high", needs_review: false, evidence: "HbA1c 7.4 % 4.0 - 5.6" },
    { test_name: "Fasting Blood Glucose", value: 138, value_text: null, unit: "mg/dL", ref_low: 70, ref_high: 100, flag: "high", needs_review: false, evidence: "Glucose Fasting 138 mg/dL 70 - 100" },
    { test_name: "Serum Creatinine", value: 0.9, value_text: null, unit: "mg/dL", ref_low: 0.7, ref_high: 1.3, flag: "normal", needs_review: false, evidence: "Creatinine 0.9 mg/dL 0.7 - 1.3" },
    { test_name: "LDL Cholesterol", value: 96, value_text: null, unit: "mg/dL", ref_low: null, ref_high: 100, flag: "unknown", needs_review: false, evidence: "LDL Cholesterol 96 mg/dL < 100" },
    { test_name: "Urine Microalbumin", value: null, value_text: "Negative", unit: null, ref_low: null, ref_high: null, flag: "unknown", needs_review: false, evidence: "Microalbumin Negative" },
  ],
  follow_up_tests: ["HbA1c", "Lipid Profile"],
  ai: mockAiMeta,
};
