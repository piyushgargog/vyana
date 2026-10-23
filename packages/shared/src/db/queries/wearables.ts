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

/**
 * Stores one row per (day, source), replacing the values when the day is synced again — a
 * health store's totals for a day grow as the day goes on, so the newest read wins.
 */
export async function upsertDailyActivity(sb: Sb, rows: DailyActivityInput[]): Promise<DbDailyActivity[]> {
  if (rows.length === 0) return [];
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("daily_activity")
      .upsert(
        rows.map((r) => ({
          patient_id: patientId,
          day: r.day,
          steps: r.steps ?? null,
          active_minutes: r.active_minutes ?? null,
          distance_m: r.distance_m ?? null,
          sleep_minutes: r.sleep_minutes ?? null,
          resting_hr: r.resting_hr ?? null,
          source: r.source,
          device_name: r.device_name ?? null,
        })),
        { onConflict: "patient_id,day,source" }
      )
      .select()
      .order("day")
  );
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
