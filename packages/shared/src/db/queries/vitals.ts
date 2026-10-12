// packages/shared/src/db/queries/vitals.ts
// Owner: Vaibhav Parmar

import type { VitalType } from "../../constants";
import { VITAL_UNITS } from "../../constants";
import type { DbVital } from "../types";
import { daysAgoIso, requireUserId, unwrap, type Sb } from "./helpers";

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
