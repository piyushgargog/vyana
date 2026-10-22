// packages/shared/src/db/queries/vitals.ts
// Owner: Vaibhav Parmar

import type { VitalType } from "../../constants";
import { VITAL_UNITS } from "../../constants";
import type { DbVital } from "../types";
import { check, daysAgoIso, requireUserId, unwrap, type Sb } from "./helpers";

export type AddVitalInput = {
  type: VitalType;
  value: number;
  /** Blood pressure only: `value` is the systolic and `value2` the diastolic reading. */
  value2?: number | null;
  /** Defaults to the standard unit of the type (`VITAL_UNITS`). */
  unit?: string;
  measured_at?: string;
};

/** Readings of one type from the last `days` days, oldest first. */
export async function listVitals(sb: Sb, type: VitalType, days: number): Promise<DbVital[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("vitals").select("*").eq("patient_id", patientId).eq("type", type).gte("measured_at", daysAgoIso(days)).order("measured_at")
  );
}

export async function addVital(sb: Sb, input: AddVitalInput): Promise<DbVital> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("vitals")
      .insert({
        patient_id: patientId,
        type: input.type,
        value: input.value,
        value2: input.value2 ?? null,
        unit: input.unit ?? VITAL_UNITS[input.type],
        ...(input.measured_at ? { measured_at: input.measured_at } : {}),
      })
      .select()
      .single()
  );
}

export type DeviceVitalInput = {
  type: VitalType;
  value: number;
  /** Blood pressure only: `value` is the systolic and `value2` the diastolic reading. */
  value2?: number | null;
  /** Defaults to the standard unit of the type (`VITAL_UNITS`). */
  unit?: string;
  measured_at: string;
  /** Where the reading came from; a batch is one source's readings. */
  source: "health_connect" | "healthkit" | "ble";
  device_name?: string | null;
  /** The source's own id for the reading — the dedupe key of the sync (#325). */
  external_id: string;
};

/**
 * Stores a batch of device readings (#325). A reading whose (source, external_id) is already
 * stored is skipped, so running the same sync twice stores nothing the second time. No conflict
 * target is named on purpose: the unique index is partial (it covers only rows that carry an
 * external id), and an unnamed "do nothing" is the form Postgres accepts for it.
 */
export async function insertVitalsBatch(sb: Sb, rows: DeviceVitalInput[]): Promise<void> {
  if (rows.length === 0) return;
  const patientId = await requireUserId(sb);
  const res = await sb.from("vitals").upsert(
    rows.map((r) => ({
      patient_id: patientId,
      type: r.type,
      value: r.value,
      value2: r.value2 ?? null,
      unit: r.unit ?? VITAL_UNITS[r.type],
      measured_at: r.measured_at,
      source: r.source,
      device_name: r.device_name ?? null,
      external_id: r.external_id,
    })),
    { ignoreDuplicates: true }
  );
  check(res);
}
