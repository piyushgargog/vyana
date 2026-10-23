// apps/mobile/src/lib/health/db.ts
// The sync's storage, over the shared database layer (issue #325): a thin translation
// between the sync's types and the query functions, nothing more.
// Owner: Vaibhav Parmar

import { getConnections, insertVitalsBatch, upsertConnection, upsertDailyActivity, type Sb } from "@vyana/shared";

import type { HealthDb } from "./sync";
import type { HealthSource } from "./types";

export function healthDb(sb: Sb, provider: HealthSource["id"]): HealthDb {
  return {
    async getConnection(requested) {
      const rows = await getConnections(sb);
      const row = rows.find((r) => r.provider === requested);
      return row ? { lastSyncAt: row.last_sync_at } : null;
    },

    async upsertDailyActivity(rows) {
      await upsertDailyActivity(
        sb,
        rows.map((r) => ({
          day: r.day,
          steps: r.steps,
          active_minutes: r.activeMinutes,
          distance_m: r.distanceM,
          sleep_minutes: r.sleepMinutes,
          resting_hr: r.restingHr,
          source: provider,
          device_name: r.deviceName,
        })),
      );
    },

    async insertVitalsBatch(rows) {
      await insertVitalsBatch(
        sb,
        rows.map((r) => ({
          type: r.type,
          value: r.value,
          value2: r.value2,
          unit: r.unit,
          measured_at: r.measuredAt,
          source: provider,
          device_name: r.deviceName,
          external_id: r.externalId,
        })),
      );
    },

    async upsertConnection(input) {
      // The shared upsert writes a whole row, so what the sync does not mention (the
      // permissions granted at connect time, the status when only an error is recorded)
      // is carried over from the row that is already there.
      const existing = (await getConnections(sb)).find((r) => r.provider === input.provider);
      await upsertConnection(sb, {
        provider: input.provider,
        status: input.status ?? (existing?.status as "connected" | "paused" | "revoked" | undefined) ?? "connected",
        permissions: existing?.permissions ?? [],
        last_sync_at: input.lastSyncAt !== undefined ? input.lastSyncAt : (existing?.last_sync_at ?? null),
        last_error: input.lastError !== undefined ? input.lastError : (existing?.last_error ?? null),
      });
    },
  };
}
