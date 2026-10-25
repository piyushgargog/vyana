import { describe, expect, it } from "vitest";
import { isoDate, PrescriptionItem, ReportAnalyzeReq } from "./contracts";

const item = (times: string[], start_date = "2026-10-12") => ({
  id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4",
  medicine_name: "Metformin",
  strength: "500 mg",
  form: "tablet",
  dose: "1 tablet",
  frequency: "BD",
  times,
  with_food: "after",
  duration_days: 30,
  start_date,
  end_date: "2026-11-10",
  instructions: null,
});

describe("isoDate", () => {
  it("accepts real days, including 29 Feb in a leap year", () => {
    for (const day of ["2026-02-28", "2024-02-29", "2026-12-31"]) expect(isoDate.safeParse(day).success).toBe(true);
  });

  it("rejects impossible calendar days the old regex let through", () => {
    for (const day of ["2026-02-30", "2026-13-01", "2026-04-31", "2023-02-29", "2026-00-10", "2026-01-00", "0000-02-29", "0000-01-01"]) {
      expect(isoDate.safeParse(day).success).toBe(false);
    }
  });

  it("rejects an impossible report date before the route ever reaches the database", () => {
    expect(ReportAnalyzeReq.safeParse({ file_path: "x/y.png", report_date: "2026-02-30" }).success).toBe(false);
    expect(ReportAnalyzeReq.safeParse({ file_path: "x/y.png", report_date: "2026-02-28" }).success).toBe(true);
  });
});

describe("hhmm", () => {
  it("accepts real times and rejects out-of-range hours and minutes", () => {
    expect(PrescriptionItem.safeParse(item(["09:00", "21:30"])).success).toBe(true);
    for (const time of ["24:00", "99:99", "12:60", "9:00"]) {
      expect(PrescriptionItem.safeParse(item([time])).success).toBe(false);
    }
  });
});
