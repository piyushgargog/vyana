// packages/shared/src/db/queries/weekly.test.ts
// Owner: Vaibhav Parmar

import { describe, expect, it } from "vitest";

import { fakeSupabase } from "./fakeSupabase";
import { getWeeklySummary } from "./weekly";

const ok = (data: unknown) => ({ data, error: null });

describe("getWeeklySummary (#495)", () => {
  it("reads the one row for the patient and week", async () => {
    const f = fakeSupabase({ responses: { weekly_summaries: [ok({ id: "w1", doses_taken: 9 })] } });
    expect(await getWeeklySummary(f.sb, "p-1", "2026-10-19")).toMatchObject({ id: "w1", doses_taken: 9 });
    const chain = f.chainOf(0).map((c) => [c.name, ...c.args]);
    expect(chain).toContainEqual(["eq", "patient_id", "p-1"]);
    expect(chain).toContainEqual(["eq", "week_start", "2026-10-19"]);
  });

  it("an unfilled week is null, not an error", async () => {
    const f = fakeSupabase({ responses: { weekly_summaries: [ok(null)] } });
    expect(await getWeeklySummary(f.sb, "p-1", "2026-10-19")).toBeNull();
  });
});
