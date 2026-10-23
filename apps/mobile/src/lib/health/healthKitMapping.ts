// apps/mobile/src/lib/health/healthKitMapping.ts
// HealthKit samples → the sync's types (issue #326). Pure, over minimal structural
// shapes, so the conversions are unit-tested without the native module. HealthKit is
// asked for our units at query time (mg/dL for glucose, metres for distance), so no
// conversion happens here — the border conversion is the wrapper's unit arguments.
// Owner: Vaibhav Parmar

import type { RawSample } from "./types";

export type HkQuantitySampleLike = {
  uuid: string;
  quantity: number;
  startDate: Date | string;
  endDate?: Date | string;
  deviceName?: string | null;
};

export type HkCategorySampleLike = {
  uuid: string;
  /** HKCategoryValueSleepAnalysis: 0 in bed, 1 asleep (unspecified), 2 awake, 3 core, 4 deep, 5 REM. */
  value: number;
  startDate: Date | string;
  endDate: Date | string;
  deviceName?: string | null;
};

const iso = (d: Date | string): string => (typeof d === "string" ? d : d.toISOString());

export function hkQuantityToSample(kind: "heart_rate" | "resting_hr" | "spo2" | "glucose" | "weight", s: HkQuantitySampleLike): RawSample {
  return { kind, at: iso(s.startDate), value: s.quantity, externalId: s.uuid, deviceName: s.deviceName ?? null };
}

/**
 * HealthKit stores blood pressure as two quantity samples (systolic, diastolic) written
 * together by the device. They are paired by their exact start instant; a systolic with
 * no diastolic partner is kept with a null second value rather than dropped — the reading
 * happened, only its pair is missing. The pair takes the systolic sample's uuid as its id.
 */
export function hkBloodPressurePairs(systolic: readonly HkQuantitySampleLike[], diastolic: readonly HkQuantitySampleLike[]): RawSample[] {
  const byStart = new Map(diastolic.map((d) => [iso(d.startDate), d]));
  return systolic.map((s) => ({
    kind: "blood_pressure" as const,
    at: iso(s.startDate),
    value: s.quantity,
    value2: byStart.get(iso(s.startDate))?.quantity ?? null,
    externalId: s.uuid,
    deviceName: s.deviceName ?? null,
  }));
}

const ASLEEP_VALUES = new Set([1, 3, 4, 5]);

/** Sleep analysis samples become one sample per asleep segment (in-bed and awake are not sleep). */
export function hkSleepSamples(samples: readonly HkCategorySampleLike[]): RawSample[] {
  return samples
    .filter((s) => ASLEEP_VALUES.has(s.value))
    .map((s) => ({ kind: "sleep" as const, at: iso(s.startDate), endAt: iso(s.endDate), value: 0, externalId: s.uuid, deviceName: s.deviceName ?? null }));
}
