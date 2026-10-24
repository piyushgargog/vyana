// packages/shared/src/db/queries/doses.test.ts
// The dose write path (issue #495): logging is an upsert on (item_id, scheduled_for), so a
// second tap updates the same row; undo deletes only the patient's own taken/skipped rows.
// Owner: Vaibhav Parmar

import { describe, expect, it } from "vitest";

import { fakeSupabase } from "./fakeSupabase";
import { logDose, undoDose } from "./doses";

const ok = (data: unknown) => ({ data, error: null });

describe("logDose (#495)", () => {
  it("upserts on (item_id, scheduled_for) with the signed-in patient filled in", async () => {
    const f = fakeSupabase({ responses: { dose_logs: [ok({ id: "d1" })] } });
    await logDose(f.sb, { item_id: "i-1", scheduled_for: "2026-10-23T02:30:00.000Z", status: "taken" });
    const [rows, opts] = f.argsOf("upsert");
    expect(rows).toMatchObject({
      patient_id: "user-1",
      item_id: "i-1",
      scheduled_for: "2026-10-23T02:30:00.000Z",
      status: "taken",
    });
    expect(opts).toEqual({ onConflict: "item_id,scheduled_for" });
  });
});

describe("undoDose (#495)", () => {
  it("deletes only the patient's own row for that item and slot, and only taken or skipped", async () => {
    const f = fakeSupabase();
    await undoDose(f.sb, { item_id: "i-1", scheduled_for: "2026-10-23T02:30:00.000Z" });
    const chain = f.chainOf(0).map((c) => [c.name, ...c.args]);
    expect(chain).toContainEqual(["delete"]);
    expect(chain).toContainEqual(["eq", "patient_id", "user-1"]);
    expect(chain).toContainEqual(["eq", "item_id", "i-1"]);
    expect(chain).toContainEqual(["eq", "scheduled_for", "2026-10-23T02:30:00.000Z"]);
    expect(chain).toContainEqual(["in", "status", ["taken", "skipped"]]);
  });
});
