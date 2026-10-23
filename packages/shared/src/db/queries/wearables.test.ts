import { describe, expect, it } from "vitest";

import { fakeSupabase } from "./fakeSupabase";
import { insertVitalsBatch } from "./vitals";
import { deleteMyDeviceData, getConnections, listDailyActivity, upsertConnection, upsertDailyActivity } from "./wearables";

const ok = (data: unknown) => ({ data, error: null });

describe("upsertDailyActivity (#325)", () => {
  it("upserts on (patient_id, day, source) with the signed-in patient filled in", async () => {
    const f = fakeSupabase({ responses: { daily_activity: [ok([{ id: "a1" }])] } });
    await upsertDailyActivity(f.sb, [{ day: "2026-10-21", steps: 8_000, sleep_minutes: 420, source: "health_connect", device_name: "Phone" }]);
    const [rows, opts] = f.argsOf("upsert");
    expect(rows).toEqual([{ patient_id: "user-1", day: "2026-10-21", steps: 8_000, sleep_minutes: 420, source: "health_connect", device_name: "Phone" }]);
    expect(opts).toEqual({ onConflict: "patient_id,day,source" });
  });

  it("a second, partial read does not clear the stored day: fields it did not return are not sent", async () => {
    const f = fakeSupabase({ responses: { daily_activity: [ok([{ id: "a1" }])] } });
    // The re-read could only produce steps this time — no distance, no sleep. Those
    // columns are absent from the payload, so the upsert leaves the stored values alone.
    await upsertDailyActivity(f.sb, [{ day: "2026-10-21", steps: 300, source: "health_connect" }]);
    const [rows] = f.argsOf("upsert");
    expect(rows).toEqual([{ patient_id: "user-1", day: "2026-10-21", steps: 300, source: "health_connect" }]);
  });

  it("groups a mixed batch by the fields each row carries, one upsert per shape", async () => {
    const f = fakeSupabase({ responses: { daily_activity: [ok([{ id: "a1", day: "2026-10-21" }]), ok([{ id: "a2", day: "2026-10-22" }])] } });
    await upsertDailyActivity(f.sb, [
      { day: "2026-10-21", steps: 8_000, distance_m: 5_300, source: "health_connect" },
      { day: "2026-10-22", steps: 1_250, source: "health_connect" },
    ]);
    const payloads = f.calls.filter((c) => c.name === "upsert").map((c) => c.args[0]);
    expect(payloads).toEqual([
      [{ patient_id: "user-1", day: "2026-10-21", steps: 8_000, distance_m: 5_300, source: "health_connect" }],
      [{ patient_id: "user-1", day: "2026-10-22", steps: 1_250, source: "health_connect" }],
    ]);
  });

  it("does nothing for an empty batch (no call, no sign-in needed)", async () => {
    const f = fakeSupabase();
    expect(await upsertDailyActivity(f.sb, [])).toEqual([]);
    expect(f.calls).toHaveLength(0);
  });
});

describe("listDailyActivity (#325)", () => {
  it("reads the patient's own rows from the day the range starts, oldest first", async () => {
    const f = fakeSupabase({ responses: { daily_activity: [ok([{ id: "a1" }])] } });
    expect(await listDailyActivity(f.sb, 30)).toEqual([{ id: "a1" }]);
    expect(f.argsOf("eq")).toEqual(["patient_id", "user-1"]);
    expect(f.argsOf("gte")[0]).toBe("day");
    expect(f.argsOf("gte")[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.argsOf("order")).toEqual(["day"]);
  });
});

describe("insertVitalsBatch (#325)", () => {
  it("upserts with ignoreDuplicates and NO conflict target (the unique index is partial)", async () => {
    const f = fakeSupabase({ responses: { vitals: [ok(null)] } });
    await insertVitalsBatch(f.sb, [
      { type: "spo2", value: 98, unit: "%", measured_at: "2026-10-21T08:00:00.000Z", source: "health_connect", device_name: "Watch", external_id: "rec-1" },
    ]);
    const [rows, opts] = f.argsOf("upsert");
    expect(rows).toEqual([
      { patient_id: "user-1", type: "spo2", value: 98, value2: null, unit: "%", measured_at: "2026-10-21T08:00:00.000Z", source: "health_connect", device_name: "Watch", external_id: "rec-1" },
    ]);
    expect(opts).toEqual({ ignoreDuplicates: true });
  });

  it("does nothing for an empty batch", async () => {
    const f = fakeSupabase();
    await insertVitalsBatch(f.sb, []);
    expect(f.calls).toHaveLength(0);
  });
});

describe("connections (#325)", () => {
  it("upsertConnection keys on (patient_id, provider) and defaults to connected", async () => {
    const f = fakeSupabase({ responses: { device_connections: [ok({ id: "c1" })] } });
    await upsertConnection(f.sb, { provider: "healthkit", permissions: ["steps", "sleep"] });
    const [row, opts] = f.argsOf("upsert");
    expect(row).toEqual({ patient_id: "user-1", provider: "healthkit", status: "connected", permissions: ["steps", "sleep"], last_sync_at: null, last_error: null });
    expect(opts).toEqual({ onConflict: "patient_id,provider" });
  });

  it("getConnections reads only the patient's own rows", async () => {
    const f = fakeSupabase({ responses: { device_connections: [ok([{ id: "c1" }])] } });
    expect(await getConnections(f.sb)).toEqual([{ id: "c1" }]);
    expect(f.argsOf("eq")).toEqual(["patient_id", "user-1"]);
  });
});

describe("deleteMyDeviceData (#325)", () => {
  it("calls the database function of the same name", async () => {
    const f = fakeSupabase({ responses: { "rpc:delete_my_device_data": [ok(null)] } });
    await deleteMyDeviceData(f.sb);
    expect(f.argsOf("rpc")).toEqual(["delete_my_device_data", undefined]);
  });
});
