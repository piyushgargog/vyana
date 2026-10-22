// apps/mobile/src/lib/health/sync.ts
// The sync itself (issue #326): read since the last successful run, aggregate, write in
// batches, and only then move last_sync_at. Never throws into the UI — the result object
// (counts and a short error code only) is all a caller ever sees.
// Owner: Vaibhav Parmar

import { aggregateSamples, mergeDaily } from "./aggregate";
import { HealthSourceError, type DailyAggregate, type HealthSource, type SpotReading } from "./types";

/** The storage the sync writes to — the real one is db.ts over @vyana/shared (#325). */
export interface HealthDb {
  getConnection(provider: HealthSource["id"]): Promise<{ lastSyncAt: string | null } | null>;
  upsertDailyActivity(rows: readonly DailyAggregate[]): Promise<void>;
  insertVitalsBatch(rows: readonly SpotReading[]): Promise<void>;
  /** Records the outcome on the connection row. `status` is left alone when not given. */
  upsertConnection(input: {
    provider: HealthSource["id"];
    status?: "connected" | "paused" | "revoked";
    lastSyncAt?: string | null;
    lastError?: string | null;
  }): Promise<void>;
}

export type SyncResult = {
  status: "ok" | "unavailable" | "denied" | "error";
  daysWritten: number;
  readingsWritten: number;
  dropped: number;
  /** A short code ('permission_denied', 'write_failed', ...) — never a message, never a value. */
  errorCode: string | null;
};

const FIRST_RUN_DAYS = 30;
const BATCH = 200;

const failed = (status: SyncResult["status"], errorCode: string): SyncResult => ({
  status,
  daysWritten: 0,
  readingsWritten: 0,
  dropped: 0,
  errorCode,
});

function chunks<T>(rows: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** A write that must never decide the sync's result (recording an error, above all). */
async function quietly(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // Nothing useful can be done with a failure to record a failure.
  }
}

export async function syncHealth(
  source: HealthSource,
  db: HealthDb,
  opts: { now?: Date; timeZone?: string } = {},
): Promise<SyncResult> {
  const now = opts.now ?? new Date();
  const timeZone = opts.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  try {
    if (!(await source.isAvailable())) {
      const conn = await db.getConnection(source.id).catch(() => null);
      if (conn) await quietly(() => db.upsertConnection({ provider: source.id, lastError: "not_installed" }));
      return failed("unavailable", "not_installed");
    }

    const conn = await db.getConnection(source.id);
    // The window starts a day before the last successful run, on purpose: a day's values
    // are computed from records that can end after the day starts (the night's sleep ends
    // in the morning), so re-reading the overlap keeps a re-sync from overwriting a whole
    // day with the half of it that happened after the last run. The unique keys make the
    // overlap free: everything in it is already stored and is skipped or rewritten equal.
    const OVERLAP_MS = 24 * 3600 * 1000;
    const since = conn?.lastSyncAt
      ? new Date(new Date(conn.lastSyncAt).getTime() - OVERLAP_MS)
      : new Date(now.getTime() - FIRST_RUN_DAYS * 24 * 3600 * 1000);

    let platformDays: DailyAggregate[];
    let samples;
    try {
      platformDays = await source.readDaily(since, now);
      samples = await source.readSamples(since, now);
    } catch (err) {
      const code = err instanceof HealthSourceError ? err.code : "read_failed";
      await quietly(() => db.upsertConnection({ provider: source.id, lastError: code }));
      return failed(code === "permission_denied" ? "denied" : "error", code);
    }

    const agg = aggregateSamples(samples, timeZone);
    const { days, dropped } = mergeDaily(platformDays, agg);

    try {
      for (const batch of chunks(days, BATCH)) await db.upsertDailyActivity(batch);
      for (const batch of chunks(agg.spots, BATCH)) await db.insertVitalsBatch(batch);
    } catch {
      // last_sync_at is NOT moved: the next run reads the same window again, and the
      // unique keys make re-writing what did land harmless.
      await quietly(() => db.upsertConnection({ provider: source.id, lastError: "write_failed" }));
      return failed("error", "write_failed");
    }

    await quietly(() =>
      db.upsertConnection({ provider: source.id, status: "connected", lastSyncAt: now.toISOString(), lastError: null }),
    );
    return { status: "ok", daysWritten: days.length, readingsWritten: agg.spots.length, dropped, errorCode: null };
  } catch {
    return failed("error", "sync_failed");
  }
}
