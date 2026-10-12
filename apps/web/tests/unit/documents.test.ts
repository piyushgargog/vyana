import { describe, expect, it } from "vitest";
import { checkUploadPath } from "@/lib/server/documents";
import { allergyWarnings, verifyRx, type RxLlm } from "@/lib/server/prescriptions";
import { flagFor, templateSummary, verifyReport, type ReportLlm } from "@/lib/server/reports";
import { hasNumber, numbersIn } from "@/lib/server/safety/verbatim";

const f = <T>(value: T | null, evidence: string | null) => ({ value, evidence });
const none = <T>() => f<T>(null, null);
const item = (over: Partial<RxLlm["items"][number]>): RxLlm["items"][number] => ({
  medicine_name: none(),
  strength: none(),
  form: none(),
  dose: none(),
  frequency: none(),
  times: none(),
  with_food: none(),
  duration_days: none(),
  quantity_total: none(),
  instructions: none(),
  ...over,
});

describe("numbersIn / hasNumber", () => {
  it("reads whole numbers, decimals and Indian grouping", () => {
    expect(numbersIn("HbA1c 7.4 % 4.0 - 5.6, platelets 1,50,000 /cumm, x 30 days.")).toEqual([1, 7.4, 4, 5.6, 150000, 30]);
  });
  it("compares as numbers, so 3 isn't found in 30 and 4 isn't found in 7.4", () => {
    expect(hasNumber("x 30 days", 30)).toBe(true);
    expect(hasNumber("x 30 days", 3)).toBe(false);
    expect(hasNumber("HbA1c 7.4 %", 4)).toBe(false);
    expect(hasNumber("range 4.0 - 5.6", 4)).toBe(true);
    expect(hasNumber(null, 1)).toBe(false);
  });
});

describe("checkUploadPath", () => {
  it("allows only the user's own folder and known file types", () => {
    expect(checkUploadPath("u1", "u1/a.JPG")).toEqual({ mime: "image/jpeg" });
    expect(checkUploadPath("u1", "u1/scan.pdf")).toEqual({ mime: "application/pdf" });
    for (const bad of ["u2/a.jpg", "u1/../u2/a.jpg", "u1/a.exe", "a.jpg", "u1x/a.jpg"]) {
      expect(() => checkUploadPath("u1", bad), bad).toThrow();
    }
  });
});

describe("verifyRx", () => {
  const text = "Dr. [NAME_1], MBBS\nDate: 2026-10-10\nDiagnosis: Type 2 Diabetes\n1. Tab. Metformin 500 mg 1-0-1 after food x 30 days\n2. Syp. Ascoril 5 ml SOS";
  const map = { "[NAME_1]": "Rajesh Mehta" };

  it("keeps proven fields, restores names, fills default times and the end date", () => {
    const rx = verifyRx(
      {
        doctor_name: f("Dr. [NAME_1]", "Dr. [NAME_1]"),
        diagnosis: f("Type 2 Diabetes", "Diagnosis: Type 2 Diabetes"),
        issued_on: f("2026-10-10", "Date: 2026-10-10"),
        items: [
          item({
            medicine_name: f("Metformin", "Tab. Metformin 500 mg"),
            strength: f("500 mg", "Metformin 500 mg"),
            form: f("tablet", "Tab."),
            frequency: f("BD", "1-0-1"),
            with_food: f("after", "after food"),
            duration_days: f(30, "x 30 days"),
          }),
        ],
      },
      text,
      map,
      "2026-10-12",
    );
    expect(rx.doctor_name).toBe("Dr. Rajesh Mehta");
    expect(rx.issued_on).toBe("2026-10-10");
    expect(rx.items[0]).toMatchObject({
      medicine_name: "Metformin",
      strength: "500 mg",
      form: "tablet",
      frequency: "BD",
      times: ["09:00", "21:00"],
      with_food: "after",
      duration_days: 30,
      start_date: "2026-10-10",
      end_date: "2026-11-08",
      needs_review: false,
    });
    expect(rx.anyReview).toBe(false);
  });

  it("never keeps a dose, frequency or duration that isn't written", () => {
    const rx = verifyRx(
      {
        doctor_name: none(),
        diagnosis: none(),
        issued_on: f("2026-10-01", "issued 1 Oct"),
        items: [
          item({
            medicine_name: f("Metformin", "Tab. Metformin 500 mg"),
            dose: f("2 tablets", "2 tablets twice daily"),
            frequency: f("TDS", "1-1-1"),
            duration_days: f(3, "x 30 days"),
            times: f(["08:00"], "8 am"),
          }),
        ],
      },
      text,
      map,
      "2026-10-12",
    );
    const [it] = rx.items;
    expect(it).toMatchObject({ dose: null, frequency: "custom", duration_days: null, times: [], end_date: null, needs_review: true });
    expect(rx.issued_on).toBe("2026-10-12");
    expect(rx.warnings.join(" ")).toMatch(/dose.*how often|how often.*dose/);
  });

  it("drops an item whose name isn't in the text and says so", () => {
    const rx = verifyRx(
      { doctor_name: none(), diagnosis: none(), issued_on: none(), items: [item({ medicine_name: f("Atorvastatin", "Tab. Atorvastatin 10 mg") })] },
      text,
      map,
      "2026-10-12",
    );
    expect(rx.items).toEqual([]);
    expect(rx.warnings[0]).toContain("line 1");
    expect(rx.anyReview).toBe(true);
  });

  it("leaves SOS medicines without reminder times", () => {
    const rx = verifyRx(
      { doctor_name: none(), diagnosis: none(), issued_on: none(), items: [item({ medicine_name: f("Ascoril", "Syp. Ascoril"), frequency: f("SOS", "SOS") })] },
      text,
      map,
      "2026-10-12",
    );
    expect(rx.items[0]).toMatchObject({ frequency: "SOS", times: [] });
  });
});

describe("allergyWarnings", () => {
  it("warns when a medicine mentions an allergy", () => {
    const items = [{ medicine_name: "Amoxicillin (Penicillin group)", instructions: null }, { medicine_name: "Dolo", instructions: null }] as never;
    expect(allergyWarnings(items, ["Penicillin", "x"])).toEqual(["Allergy alert: Amoxicillin (Penicillin group) may contain Penicillin."]);
  });
});

describe("verifyReport", () => {
  const text = "HbA1c 7.4 % 4.0 - 5.6\nFasting Blood Sugar 115 mg/dL 70 - 100\nTSH 2.1 uIU/mL\nUrine colour Pale yellow";
  const row = (over: Partial<ReportLlm["values"][number]>): ReportLlm["values"][number] => ({
    test_name: "HbA1c",
    value: 7.4,
    value_text: null,
    unit: "%",
    ref_low: 4,
    ref_high: 5.6,
    evidence: "HbA1c 7.4 % 4.0 - 5.6",
    ...over,
  });
  const base = { lab_name: none<string>(), report_date: none<string>() };

  it("computes flags in code and keeps verified rows", () => {
    const out = verifyReport(
      {
        ...base,
        values: [
          row({}),
          row({ test_name: "TSH", value: 2.1, unit: "uIU/mL", ref_low: null, ref_high: null, evidence: "TSH 2.1 uIU/mL" }),
          row({ test_name: "Urine colour", value: null, value_text: "Pale yellow", unit: null, ref_low: null, ref_high: null, evidence: "Urine colour Pale yellow" }),
        ],
      },
      text,
      {},
    );
    expect(out.values.map((v) => [v.test_name, v.flag, v.needs_review])).toEqual([
      ["HbA1c", "high", false],
      ["TSH", "unknown", false],
      ["Urine colour", "unknown", false],
    ]);
  });

  it("clears numbers that aren't printed in the row and drops invented rows", () => {
    const out = verifyReport(
      {
        ...base,
        values: [row({ value: 6.9 }), row({ test_name: "Vitamin D", value: 12, evidence: "Vitamin D 12 ng/mL 30 - 100" })],
      },
      text,
      {},
    );
    expect(out.values).toHaveLength(1);
    expect(out.values[0]).toMatchObject({ value: null, flag: "unknown", needs_review: true });
    expect(out.anyReview).toBe(true);
  });

  it("flagFor handles one-sided ranges and missing values", () => {
    expect(flagFor(3, 4, null)).toBe("low");
    expect(flagFor(200, null, 199)).toBe("high");
    expect(flagFor(5, 4, 5.6)).toBe("normal");
    expect(flagFor(null, 4, 5.6)).toBe("unknown");
    expect(flagFor(5, null, null)).toBe("unknown");
  });

  it("the fallback summary only states facts", () => {
    const s = templateSummary([
      { test_name: "HbA1c", flag: "high" },
      { test_name: "TSH", flag: "normal" },
    ] as never);
    expect(s).toBe("1 of 2 values are outside their reference range: HbA1c. Please discuss these results with your doctor.");
  });
});
