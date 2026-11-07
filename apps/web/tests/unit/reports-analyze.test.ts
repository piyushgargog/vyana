import { describe, expect, it, vi } from "vitest";
import { analyzeReport } from "@/lib/server/reports";

// The fake admin client records every write, so the test can prove the failed report leaves no lab values behind.
const state = vi.hoisted(() => ({ calls: [] as { table: string; op: string; payload?: unknown; eq?: [string, unknown] }[], failDoneUpdate: true }));

const TRANSCRIPT = [
  "[mock] Sample Diagnostics",
  "Report date: 2026-10-05",
  "Test Result Unit Reference range",
  "HbA1c 7.4 % 4.0 - 5.6",
  "Fasting Blood Sugar 115 mg/dL 70 - 100",
  "Haemoglobin 13.5 g/dL 13.0 - 17.0",
].join("\n");

const EXTRACT = {
  lab_name: { value: "[mock] Sample Diagnostics", evidence: "[mock] Sample Diagnostics" },
  report_date: { value: "2026-10-05", evidence: "Report date: 2026-10-05" },
  values: [
    { test_name: "HbA1c", value: 7.4, value_text: null, unit: "%", ref_low: 4, ref_high: 5.6, evidence: "HbA1c 7.4 % 4.0 - 5.6" },
    { test_name: "Fasting Blood Sugar", value: 115, value_text: null, unit: "mg/dL", ref_low: 70, ref_high: 100, evidence: "Fasting Blood Sugar 115 mg/dL 70 - 100" },
    { test_name: "Haemoglobin", value: 13.5, value_text: null, unit: "g/dL", ref_low: 13, ref_high: 17, evidence: "Haemoglobin 13.5 g/dL 13.0 - 17.0" },
  ],
};

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      insert: (rows: unknown) => {
        state.calls.push({ table, op: "insert", payload: rows });
        return {
          select: () => {
            if (table === "lab_reports") return { single: async () => ({ data: { id: "report-1" }, error: null }) };
            return Promise.resolve({ data: [{ id: "v-1" }, { id: "v-2" }, { id: "v-3" }], error: null });
          },
        };
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (col: string, val: unknown) => {
          state.calls.push({ table, op: "update", payload: patch, eq: [col, val] });
          if (table === "lab_reports" && patch.status === "done" && state.failDoneUpdate) return { error: new Error("final update failed") };
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (col: string, val: unknown) => {
          state.calls.push({ table, op: "delete", eq: [col, val] });
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/server/documents", () => ({
  checkUploadPath: () => ({ mime: "application/pdf" }),
  downloadUpload: async () => new Uint8Array(),
  readDocumentText: async () => ({ text: TRANSCRIPT, source: "text_layer" as const, ai: null }),
}));

vi.mock("@/lib/server/ai", () => ({
  runAi: async (args: { feature: string }) =>
    args.feature === "report_extract"
      ? { object: EXTRACT, ai: { model: "mock", run_id: null } }
      : { object: { summary: "All 3 values that could be read are within their reference ranges." }, ai: { model: "mock", run_id: null } },
}));

const authed = {
  user: { id: "u-1" },
  profile: { full_name: null, preferred_language: "en" },
} as unknown as Parameters<typeof analyzeReport>[0];

describe("analyzeReport (failed report leaves no values behind, #657)", () => {
  it("deletes the inserted lab values when the final report update fails", async () => {
    state.calls.length = 0;
    state.failDoneUpdate = true;
    await expect(analyzeReport(authed, "u-1/report.pdf", undefined)).rejects.toThrow("Could not read this report");
    const inserted = state.calls.find((c) => c.table === "lab_values" && c.op === "insert");
    expect(inserted).toBeDefined();
    expect((inserted?.payload as unknown[]).length).toBe(3);
    const deleted = state.calls.findIndex((c) => c.table === "lab_values" && c.op === "delete" && c.eq?.[0] === "report_id" && c.eq?.[1] === "report-1");
    expect(deleted).toBeGreaterThan(-1);
    const markedFailed = state.calls.findIndex((c) => c.table === "lab_reports" && c.op === "update" && (c.payload as Record<string, unknown>)?.status === "failed");
    expect(markedFailed).toBeGreaterThan(deleted);
  });

  it("keeps the values when the final report update succeeds", async () => {
    state.calls.length = 0;
    state.failDoneUpdate = false;
    const res = await analyzeReport(authed, "u-1/report.pdf", undefined);
    expect(res.report_id).toBe("report-1");
    expect(res.values).toHaveLength(3);
    expect(state.calls.some((c) => c.table === "lab_values" && c.op === "delete")).toBe(false);
  });
});
