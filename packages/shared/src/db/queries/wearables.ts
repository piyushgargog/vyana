// packages/shared/src/db/queries/wearables.ts
// The device data of #325 (ADR-073): daily activity aggregates and the connections that
// brought them. The sync engine that fills these tables is #326; this file is only storage.
// Owner: Vaibhav Parmar

import type { DbDailyActivity, DbDeviceConnection } from "../types";
import { check, daysAgoIso, requireUserId, unwrap, type Sb } from "./helpers";

/** Where a device row came from. `manual` is a person typing a reading in, never a device. */
export type DeviceSource = "health_connect" | "healthkit" | "ble";
export type DeviceProvider = DeviceSource;

export type DailyActivityInput = {
  /** The day the activity belongs to, `yyyy-mm-dd` in the phone's own zone (the sync decides). */
  day: string;
  steps?: number | null;
  active_minutes?: number | null;
  distance_m?: number | null;
  sleep_minutes?: number | null;
  resting_hr?: number | null;
  source: DeviceSource;
  device_name?: string | null;
};

type DailyActivityRow = {
  patient_id: string;
  day: string;
  source: DeviceSource;
  steps?: number;
  active_minutes?: number;
  distance_m?: number;
  sleep_minutes?: number;
  resting_hr?: number;
  device_name?: string;
};

/**
 * Stores one row per (day, source) — a health store's totals for a day grow as the day
 * goes on, so the newest read wins for the fields it returns. A field the read did not
 * return (null) is left out of the write entirely: a re-read that could not produce a
 * value must never clear the one already stored. Rows are grouped by the fields they
 * carry, because one upsert call needs one shape.
 */
export async function upsertDailyActivity(sb: Sb, rows: DailyActivityInput[]): Promise<DbDailyActivity[]> {
  if (rows.length === 0) return [];
  const patientId = await requireUserId(sb);
  const groups = new Map<string, DailyActivityRow[]>();
  for (const r of rows) {
    const row: DailyActivityRow = { patient_id: patientId, day: r.day, source: r.source };
    if (r.steps != null) row.steps = r.steps;
    if (r.active_minutes != null) row.active_minutes = r.active_minutes;
    if (r.distance_m != null) row.distance_m = r.distance_m;
    if (r.sleep_minutes != null) row.sleep_minutes = r.sleep_minutes;
    if (r.resting_hr != null) row.resting_hr = r.resting_hr;
    if (r.device_name != null) row.device_name = r.device_name;
    const shape = Object.keys(row).sort().join(",");
    groups.set(shape, [...(groups.get(shape) ?? []), row]);
  }
  const out: DbDailyActivity[] = [];
  for (const group of groups.values()) {
    out.push(...unwrap(await sb.from("daily_activity").upsert(group, { onConflict: "patient_id,day,source" }).select().order("day")));
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

/** The last `days` days of activity, oldest first, every source the patient has. */
export async function listDailyActivity(sb: Sb, days: number): Promise<DbDailyActivity[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("daily_activity").select("*").eq("patient_id", patientId).gte("day", daysAgoIso(days).slice(0, 10)).order("day")
  );
}

export type ConnectionInput = {
  provider: DeviceProvider;
  status?: "connected" | "paused" | "revoked";
  permissions?: string[];
  last_sync_at?: string | null;
  /** A short code only ('permission_denied', 'not_installed', ...), never a message or a value. */
  last_error?: string | null;
};

/** The patient's device connections, one per provider. */
export async function getConnections(sb: Sb): Promise<DbDeviceConnection[]> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("device_connections").select("*").eq("patient_id", patientId).order("provider"));
}

/** Creates or updates the connection for a provider (the sync's bookkeeping lives here). */
export async function upsertConnection(sb: Sb, input: ConnectionInput): Promise<DbDeviceConnection> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("device_connections")
      .upsert(
        {
          patient_id: patientId,
          provider: input.provider,
          status: input.status ?? "connected",
          permissions: input.permissions ?? [],
          last_sync_at: input.last_sync_at ?? null,
          last_error: input.last_error ?? null,
        },
        { onConflict: "patient_id,provider" }
      )
      .select()
      .single()
  );
}

/**
 * "Disconnect and delete my device data" (ADR-073): every device-sourced vital and every
 * daily activity row of the caller is deleted and their connections are set to revoked.
 * Manual entries are not touched. The work is the database function's, so the rule lives
 * in one place (migration 0019).
 */
export async function deleteMyDeviceData(sb: Sb): Promise<void> {
  check(await sb.rpc("delete_my_device_data"));
}
