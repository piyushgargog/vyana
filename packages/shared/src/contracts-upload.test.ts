import { describe, expect, it } from "vitest";

import { PrescriptionExtractReq, ReportAnalyzeReq } from "./contracts";

describe("upload request schemas", () => {
  it("reject an empty file_path on both upload routes", () => {
    expect(PrescriptionExtractReq.safeParse({ file_path: "" }).success).toBe(false);
    expect(ReportAnalyzeReq.safeParse({ file_path: "" }).success).toBe(false);
  });

  it("still accept a real file path", () => {
    expect(PrescriptionExtractReq.safeParse({ file_path: "user-1/abc.pdf" }).success).toBe(true);
    expect(ReportAnalyzeReq.safeParse({ file_path: "user-1/abc.pdf" }).success).toBe(true);
  });
});
