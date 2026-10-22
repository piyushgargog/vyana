import { describe, expect, it } from "vitest";

import { MockHealthSource } from "./mock";
import { syncHealth, type HealthDb } from "./sync";
import type { DailyAggregate, HealthSource, SpotReading } from "./types";

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
    for (const r of rows) this.days.set(r.day, r);
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
    // The window now starts at noon on the 21st: two daily rows come back, no new spot
    // fixtures are in it, and — the point of the overlap — the 22nd's sleep, computed from
    // a record that started on the 21st, is still computed and stored, not overwritten
    // with an empty half-day.
    const res = await run(new MockHealthSource(), db);
    expect(res.daysWritten).toBe(2);
    expect(res.readingsWritten).toBe(0);
    expect(db.days.get("2026-10-22")?.sleepMinutes).toBe(432);
    expect(db.days.get("2026-10-21")?.steps).toBe(8_010);
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
