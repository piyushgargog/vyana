import { describe, expect, it } from "vitest";

import { MockHealthSource } from "./mock";
import { syncHealth, type HealthDb } from "./sync";
import type { DailyAggregate, HealthMetric, HealthSource, SpotReading } from "./types";

/** Storage with the database's unique keys, so a second sync really stores nothing new. */
class FakeDb implements HealthDb {
  vitals = new Map<string, SpotReading>();
  days = new Map<string, DailyAggregate>();
  connection: { status?: string; lastSyncAt: string | null; lastError: string | null } = { lastSyncAt: null, lastError: null };
  failWrites = false;

  async getConnection() {
    return { lastSyncAt: this.connection.lastSyncAt };
  }
  async upsertDailyActivity(rows: readonly DailyAggregate[]) {
    if (this.failWrites) throw new Error("db down");
    for (const r of rows) {
      const prev = this.days.get(r.day);
      // Mirrors the storage layer (@vyana/shared, queries/wearables.ts): a field the
      // read did not return never clears the value already stored.
      this.days.set(
        r.day,
        prev
          ? {
              day: r.day,
              steps: r.steps ?? prev.steps,
              activeMinutes: r.activeMinutes ?? prev.activeMinutes,
              distanceM: r.distanceM ?? prev.distanceM,
              sleepMinutes: r.sleepMinutes ?? prev.sleepMinutes,
              restingHr: r.restingHr ?? prev.restingHr,
              deviceName: r.deviceName ?? prev.deviceName,
            }
          : r,
      );
    }
  }
  async insertVitalsBatch(rows: readonly SpotReading[]) {
    if (this.failWrites) throw new Error("db down");
    for (const r of rows) if (!this.vitals.has(r.externalId)) this.vitals.set(r.externalId, r);
  }
  async upsertConnection(input: { status?: "connected" | "paused" | "revoked"; lastSyncAt?: string | null; lastError?: string | null }) {
    if (input.status !== undefined) this.connection.status = input.status;
    if (input.lastSyncAt !== undefined) this.connection.lastSyncAt = input.lastSyncAt;
    if (input.lastError !== undefined) this.connection.lastError = input.lastError;
  }
}

/** A source that remembers the window each daily read was asked for. */
class RecordingSource implements HealthSource {
  readonly id: HealthSource["id"];
  windows: Date[] = [];
  constructor(private readonly inner: HealthSource) {
    this.id = inner.id;
  }
  isAvailable() {
    return this.inner.isAvailable();
  }
  requestPermissions(metrics: readonly HealthMetric[]) {
    return this.inner.requestPermissions(metrics);
  }
  async readDaily(from: Date, to: Date) {
    this.windows.push(from);
    return this.inner.readDaily(from, to);
  }
  readSamples(from: Date, to: Date) {
    return this.inner.readSamples(from, to);
  }
}

const NOW = new Date("2026-10-22T12:00:00Z");
const run = (source: HealthSource, db: FakeDb) => syncHealth(source, db, { now: NOW, timeZone: "UTC" });

describe("syncHealth with the mock source", () => {
  it("writes the days and the spot readings, and moves last_sync_at", async () => {
    const db = new FakeDb();
    const res = await run(new MockHealthSource(), db);
    expect(res).toEqual({ status: "ok", daysWritten: 3, readingsWritten: 4, dropped: 0, errorCode: null });
    expect(db.days.size).toBe(3);
    expect(db.days.get("2026-10-22")?.sleepMinutes).toBe(432);
    expect(db.days.get("2026-10-22")?.restingHr).toBe(59);
    expect(db.vitals.size).toBe(4);
    expect(db.connection.lastSyncAt).toBe(NOW.toISOString());
    expect(db.connection.status).toBe("connected");
  });

  it("a second sync with the same data stores zero new readings", async () => {
    const db = new FakeDb();
    await run(new MockHealthSource(), db);
    const before = db.vitals.size;
    const res = await run(new MockHealthSource(), db);
    expect(res.status).toBe("ok");
    expect(db.vitals.size).toBe(before);
    expect(db.days.size).toBe(3);
  });

  it("reads from a day before last_sync_at the second time (the overlap keeps whole days whole)", async () => {
    const db = new FakeDb();
    await run(new MockHealthSource(), db);
    // The window now starts at midnight on the 21st: two daily rows come back, the
    // 21st's morning spot readings are read again (and stored nowhere new — the
    // unique keys skip them), and — the point of the overlap — the 22nd's sleep,
    // computed from a record that started on the 21st, is still computed and stored,
    // not overwritten with an empty half-day.
    const res = await run(new MockHealthSource(), db);
    expect(res.daysWritten).toBe(2);
    expect(res.readingsWritten).toBe(3);
    expect(db.vitals.size).toBe(4);
    expect(db.days.get("2026-10-22")?.sleepMinutes).toBe(432);
    expect(db.days.get("2026-10-21")?.steps).toBe(8_010);
  });

  it("starts the re-sync window at local midnight of the day before the last sync", async () => {
    const db = new FakeDb();
    const source = new RecordingSource(new MockHealthSource());
    await run(source, db);
    await run(source, db);
    // last_sync_at is noon on the 22nd (UTC in this harness); the window opens at
    // midnight on the 21st, so the overlap day is always re-read whole, never from
    // the middle.
    expect(source.windows[1]?.toISOString()).toBe("2026-10-21T00:00:00.000Z");
  });

  it("a second read that is only a partial day does not clear what the first stored", async () => {
    const db = new FakeDb();
    await run(new MockHealthSource(), db);
    // The re-read could only produce steps this time — a partial day. What it did
    // not return (distance, active minutes, resting heart rate) must survive.
    const partial: HealthSource = {
      id: "health_connect",
      isAvailable: async () => true,
      requestPermissions: async () => ({ state: "granted", granted: [] }),
      readDaily: async () => [{ day: "2026-10-21", steps: 300, activeMinutes: null, distanceM: null, sleepMinutes: null, restingHr: null, deviceName: null }],
      readSamples: async () => [],
    };
    const res = await run(partial, db);
    expect(res.status).toBe("ok");
    expect(db.days.get("2026-10-21")?.distanceM).toBe(5_300);
    expect(db.days.get("2026-10-21")?.activeMinutes).toBe(32);
    expect(db.days.get("2026-10-21")?.restingHr).toBe(64);
  });

  it("a failed batch does not move last_sync_at, and the error is a code, not a message", async () => {
    const db = new FakeDb();
    db.failWrites = true;
    const res = await run(new MockHealthSource(), db);
    expect(res.status).toBe("error");
    expect(res.errorCode).toBe("write_failed");
    expect(db.connection.lastSyncAt).toBeNull();
    expect(db.connection.lastError).toBe("write_failed");
  });

  it("a denied permission is a result, with nothing written", async () => {
    const db = new FakeDb();
    const res = await run(new MockHealthSource({ failReadsWith: "permission_denied" }), db);
    expect(res).toEqual({ status: "denied", daysWritten: 0, readingsWritten: 0, dropped: 0, errorCode: "permission_denied" });
    expect(db.vitals.size).toBe(0);
    expect(db.connection.lastError).toBe("permission_denied");
    expect(db.connection.lastSyncAt).toBeNull();
  });

  it("no health store on the phone is 'unavailable', not an error", async () => {
    const db = new FakeDb();
    const res = await run(new MockHealthSource({ available: false }), db);
    expect(res.status).toBe("unavailable");
    expect(res.errorCode).toBe("not_installed");
    expect(db.vitals.size).toBe(0);
  });
});
