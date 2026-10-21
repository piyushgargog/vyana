import { describe, expect, it } from "vitest";

import { buildMemory, type MemorySources } from "./memory";

const TODAY = "2026-10-13"; // every window below is counted from this day in India

const empty: MemorySources = { labs: [], vitals: [], medicines: [], adherence: [] };
const src = (part: Partial<MemorySources>): MemorySources => ({ ...empty, ...part });

const lab = (test_name: string, measured_on: string, value: number | null, extra: Partial<MemorySources["labs"][number]> = {}) => ({
  test_name,
  measured_on,
  value,
  unit: "%",
  flag: "normal",
  ref_low: null,
  ref_high: null,
  ...extra,
});

describe("buildMemory", () => {
  it("leaves the sections whose scope is off out of the result entirely", () => {
    const memory = buildMemory(src({ labs: [lab("HbA1c", "2026-10-01", 7.0)] }), ["labs"], TODAY);
    expect(memory.labs).toHaveLength(1);
    expect("vitals" in memory).toBe(false);
    expect("medicines" in memory).toBe(false);
    expect("adherence" in memory).toBe(false);
    expect(buildMemory(empty, [], TODAY)).toEqual({});
  });

  it("groups lab points by test, oldest first, with the range of the latest reading that has one", () => {
    const memory = buildMemory(
      src({
        labs: [
          lab("HbA1c", "2026-10-06", 7.4, { flag: "high" }), // newest: no range of its own
          lab("HbA1c", "2026-07-06", 6.8, { ref_low: 4.0, ref_high: 5.6 }),
          lab("HbA1c", "2026-09-06", null), // no number: cannot be drawn, left out
          lab("Fasting glucose", "2026-10-02", 110, { unit: "mg/dL" }),
        ],
      }),
      ["labs"],
      TODAY,
    );
    expect(memory.labs?.map((t) => t.test_name)).toEqual(["HbA1c", "Fasting glucose"]);
    expect(memory.labs?.[0]).toEqual({
      test_name: "HbA1c",
      unit: "%",
      ref_low: 4.0,
      ref_high: 5.6,
      points: [
        { date: "2026-07-06", value: 6.8, flag: "normal" },
        { date: "2026-10-06", value: 7.4, flag: "high" },
      ],
    });
  });

  it("keeps at most 24 points per test and 24 tests, and nothing older than 24 months", () => {
    const many = Array.from({ length: 30 }, (_, i) => lab("HbA1c", `2026-09-${String(i + 1).padStart(2, "0")}`, 7));
    const memory = buildMemory(src({ labs: many }), ["labs"], TODAY);
    expect(memory.labs?.[0].points).toHaveLength(24);
    expect(memory.labs?.[0].points[0].date).toBe("2026-09-07"); // the newest 24 survive

    const tests = Array.from({ length: 30 }, (_, i) => lab(`Test ${i}`, "2026-10-01", 1));
    expect(buildMemory(src({ labs: tests }), ["labs"], TODAY).labs).toHaveLength(24);

    const boundary = buildMemory(src({ labs: [lab("Old", "2024-10-12", 1), lab("Edge", "2024-10-13", 1)] }), ["labs"], TODAY);
    expect(boundary.labs?.map((t) => t.test_name)).toEqual(["Edge"]); // 24 months back is in, a day older is out
  });

  it("reads a flag it does not know as unknown", () => {
    const memory = buildMemory(src({ labs: [lab("X", "2026-10-01", 1, { flag: "critical-ish" })] }), ["labs"], TODAY);
    expect(memory.labs?.[0].points[0].flag).toBe("unknown");
  });

  it("builds vitals as timestamped points inside 12 months by the day in India, without numberless readings", () => {
    const memory = buildMemory(
      src({
        vitals: [
          { type: "bp", value: 120, value2: 80, unit: "mmHg", measured_at: "2025-10-12T19:00:00Z" }, // 2025-10-13 in India: in
          { type: "bp", value: 130, value2: 85, unit: "mmHg", measured_at: "2025-10-11T18:00:00Z" }, // 2025-10-11 in India: out
          { type: "bp", value: null, value2: null, unit: "mmHg", measured_at: "2026-10-01T00:00:00Z" }, // no number: left out
          { type: "weight", value: 70, value2: null, unit: null, measured_at: "2026-10-01T00:00:00Z" },
        ],
      }),
      ["vitals"],
      TODAY,
    );
    expect(memory.vitals).toEqual([
      { type: "weight", unit: null, points: [{ at: "2026-10-01T00:00:00Z", value: 70, value2: null }] },
      { type: "bp", unit: "mmHg", points: [{ at: "2025-10-12T19:00:00Z", value: 120, value2: 80 }] },
    ]);
  });

  it("starts a medicine on the day it was started, not the day it was typed in", () => {
    const memory = buildMemory(
      src({
        medicines: [
          {
            medicine_name: "Metformin",
            strength: "500 mg",
            dose: "1 tablet",
            frequency: "BD",
            start_date: "2022-01-15", // taken since 2022…
            created_at: "2026-10-06T10:00:00Z", // …but only added to Vyana last week
            end_date: null,
          },
          {
            medicine_name: "Telma",
            strength: "40 mg",
            dose: "1 tablet",
            frequency: "OD",
            start_date: null, // no start day recorded: the day it was added is the fallback
            created_at: "2026-03-02T10:00:00Z",
            end_date: null,
          },
          {
            medicine_name: "Long finished",
            strength: null,
            dose: null,
            frequency: "OD",
            start_date: "2024-01-01",
            created_at: "2024-01-01T00:00:00Z",
            end_date: "2025-09-01", // ended more than 12 months ago: outside the bars' stretch
          },
        ],
      }),
      ["medicines"],
      TODAY,
    );
    expect(memory.medicines).toEqual([
      { name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD", start: "2022-01-15", end: null },
      { name: "Telma", strength: "40 mg", dose: "1 tablet", frequency: "OD", start: "2026-03-02", end: null },
    ]);
  });

  it("counts adherence over exactly the last 30 days in India, with a percent of what was logged", () => {
    const memory = buildMemory(
      src({
        adherence: [
          { scheduled_for: "2026-10-13T03:30:00Z", status: "taken" }, // 09:00 IST today
          { scheduled_for: "2026-10-12T03:30:00Z", status: "missed" },
          { scheduled_for: "2026-08-01T03:30:00Z", status: "taken" }, // outside the window
          { scheduled_for: "2026-10-13T04:30:00Z", status: "due" }, // not a logged outcome
        ],
      }),
      ["adherence"],
      TODAY,
    );
    expect(memory.adherence?.days).toHaveLength(30);
    expect(memory.adherence?.days[0].date).toBe("2026-09-14");
    expect(memory.adherence?.days[29]).toEqual({ date: "2026-10-13", taken: 1, missed: 0, skipped: 0 });
    expect(memory.adherence?.days[28]).toEqual({ date: "2026-10-12", taken: 0, missed: 1, skipped: 0 });
    expect(memory.adherence?.percent_taken).toBe(50);
    expect(buildMemory(empty, ["adherence"], TODAY).adherence?.percent_taken).toBeNull();
  });
});
