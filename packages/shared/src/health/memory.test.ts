import { describe, expect, it } from "vitest";

import { buildMemory, MEMORY_LAB_POINTS, type MemorySources } from "./index";

const TODAY = "2026-10-13";

const empty: MemorySources = { labs: [], vitals: [], medicines: [], adherence: [] };

const lab = (test_name: string, measured_on: string | null, value: number, extra: Partial<MemorySources["labs"][number]> = {}) => ({
  test_name,
  value,
  value_text: null,
  unit: "%",
  flag: "normal",
  ref_low: null,
  ref_high: null,
  measured_on,
  ...extra,
});

describe("buildMemory", () => {
  it("gives null sections for the scopes that are off, and for no scopes at all", () => {
    expect(buildMemory(empty, [], TODAY)).toEqual({ labs: null, vitals: null, medicines: null, adherence: null });
    const memory = buildMemory({ ...empty, labs: [lab("HbA1c", "2026-10-01", 7.4)] }, ["vitals"], TODAY);
    expect(memory.labs).toBeNull();
    expect(memory.vitals).toEqual([]);
  });

  it("groups lab values by test, oldest first, with the unit and the reference range of the points", () => {
    const memory = buildMemory(
      {
        ...empty,
        labs: [
          lab("HbA1c", "2026-10-06", 7.4, { flag: "high", ref_low: 4.0, ref_high: 5.6 }),
          lab("HbA1c", "2026-07-06", 6.8),
          lab("LDL", "2026-09-01", 130, { unit: "mg/dL" }),
        ],
      },
      ["labs"],
      TODAY,
    );
    expect(memory.labs?.map((t) => t.test_name)).toEqual(["HbA1c", "LDL"]); // most recently measured first
    expect(memory.labs?.[0]).toEqual({
      test_name: "HbA1c",
      unit: "%",
      points: [
        { date: "2026-07-06", value: 6.8, value_text: null, flag: "normal", ref_low: null, ref_high: null },
        { date: "2026-10-06", value: 7.4, value_text: null, flag: "high", ref_low: 4.0, ref_high: 5.6 },
      ],
    });
  });

  it("keeps labs of the last 24 months only, and skips a value with no date", () => {
    const memory = buildMemory(
      { ...empty, labs: [lab("HbA1c", "2024-10-13", 8.1), lab("HbA1c", "2024-10-12", 8.4), lab("HbA1c", null, 9.0)] },
      ["labs"],
      TODAY,
    );
    expect(memory.labs?.[0].points.map((p) => p.value)).toEqual([8.1]);
  });

  it("caps a test at the newest 24 points and the graph at 24 tests", () => {
    const many = Array.from({ length: MEMORY_LAB_POINTS + 6 }, (_, i) => lab("HbA1c", `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, "0")}`, i));
    expect(buildMemory({ ...empty, labs: many }, ["labs"], TODAY).labs?.[0].points).toHaveLength(MEMORY_LAB_POINTS);
    const tests = Array.from({ length: 26 }, (_, i) => lab(`Test ${String(i).padStart(2, "0")}`, `2026-10-${String(1 + (i % 9)).padStart(2, "0")}`, i));
    expect(buildMemory({ ...empty, labs: tests }, ["labs"], TODAY).labs).toHaveLength(24);
  });

  it("reads an odd flag as unknown", () => {
    const memory = buildMemory({ ...empty, labs: [lab("HbA1c", "2026-10-06", 7.4, { flag: "critical" })] }, ["labs"], TODAY);
    expect(memory.labs?.[0].points[0].flag).toBe("unknown");
  });

  it("groups vitals by type over the last 12 months, the day counted in India", () => {
    const memory = buildMemory(
      {
        ...empty,
        vitals: [
          // 2025-10-12 19:00 UTC is already 2025-10-13 in India: inside the 12 months.
          { type: "bp", value: 120, value2: 80, unit: "mmHg", measured_at: "2025-10-12T19:00:00.000Z" },
          { type: "bp", value: 130, value2: 85, unit: "mmHg", measured_at: "2026-10-10T04:00:00.000Z" },
          // The day before, in India: outside.
          { type: "bp", value: 110, value2: 70, unit: "mmHg", measured_at: "2025-10-11T18:00:00.000Z" },
          { type: "weight", value: 70, value2: null, unit: "kg", measured_at: "2026-09-01T04:00:00.000Z" },
        ],
      },
      ["vitals"],
      TODAY,
    );
    expect(memory.vitals?.map((s) => s.type)).toEqual(["bp", "weight"]);
    expect(memory.vitals?.[0].points).toEqual([
      { date: "2025-10-13", value: 120, value2: 80 },
      { date: "2026-10-10", value: 130, value2: 85 },
    ]);
  });

  it("keeps current medicines and ones that ended within the year, with their days", () => {
    const memory = buildMemory(
      {
        ...empty,
        medicines: [
          { medicine_name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD", created_at: "2026-01-01T05:00:00.000Z", end_date: null },
          { medicine_name: "Course done", strength: null, dose: null, frequency: "TDS", created_at: "2026-03-01T05:00:00.000Z", end_date: "2026-03-10" },
          { medicine_name: "Long over", strength: null, dose: null, frequency: "OD", created_at: "2024-01-01T05:00:00.000Z", end_date: "2024-02-01" },
        ],
      },
      ["medicines"],
      TODAY,
    );
    expect(memory.medicines).toEqual([
      { name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD", from: "2026-01-01", to: null },
      { name: "Course done", strength: null, dose: null, frequency: "TDS", from: "2026-03-01", to: "2026-03-10" },
    ]);
  });

  it("counts adherence over exactly 30 days, by the day in India, with the percent taken", () => {
    const memory = buildMemory(
      {
        ...empty,
        adherence: [
          { scheduled_for: "2026-10-12T19:30:00.000Z", status: "taken" }, // 01:00 on 13 Oct in India
          { scheduled_for: "2026-10-13T03:30:00.000Z", status: "taken" }, // 09:00 on 13 Oct
          { scheduled_for: "2026-10-13T15:30:00.000Z", status: "missed" }, // 21:00 on 13 Oct
          { scheduled_for: "2026-10-12T03:30:00.000Z", status: "skipped" }, // 09:00 on 12 Oct
          { scheduled_for: "2026-08-01T03:30:00.000Z", status: "missed" }, // outside the 30 days
        ],
      },
      ["adherence"],
      TODAY,
    );
    expect(memory.adherence?.days).toHaveLength(30);
    expect(memory.adherence?.days[0].date).toBe("2026-09-14");
    expect(memory.adherence?.days[29]).toEqual({ date: "2026-10-13", taken: 2, missed: 1, skipped: 0 });
    expect(memory.adherence?.days[28]).toEqual({ date: "2026-10-12", taken: 0, missed: 0, skipped: 1 });
    expect(memory.adherence?.percent).toBe(50);
  });

  it("gives a null percent when nothing was logged in the 30 days", () => {
    const memory = buildMemory(empty, ["adherence"], TODAY);
    expect(memory.adherence?.percent).toBeNull();
    expect(memory.adherence?.days.every((d) => d.taken + d.missed + d.skipped === 0)).toBe(true);
  });
});
