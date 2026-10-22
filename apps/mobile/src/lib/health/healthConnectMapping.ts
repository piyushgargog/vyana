// apps/mobile/src/lib/health/healthConnectMapping.ts
// Health Connect read results → the sync's types (issue #326). Pure: the platform calls
// live in healthConnect.ts, so every conversion here is unit-tested with real-shaped
// results. Note the read side differs from the write side: readRecords hands back
// RecordResult shapes — no recordType field, and measured values arrive already
// converted into every unit (a glucose level carries inMilligramsPerDeciliter next to
// inMillimolesPerLiter), so the mapper picks the unit Vyana stores instead of converting.
// Owner: Vaibhav Parmar

import type { RecordResult } from "react-native-health-connect";

import type { RawSample } from "./types";

/** The app or device that wrote the record — the "from <device>" of ADR-073. */
const origin = (r: { metadata?: { dataOrigin?: string } }): string | null => r.metadata?.dataOrigin ?? null;
const id = (r: { metadata?: { id?: string } }, fallback: string): string => r.metadata?.id ?? fallback;

/** Sleep stage codes (Health Connect): 1 awake, 2 sleeping, 3 out of bed, 4 light, 5 deep, 6 REM, 0/7 unknown. */
const ASLEEP_STAGES = new Set([2, 4, 5, 6]);

/**
 * A sleep session becomes one sample per asleep segment, so awake time inside the night
 * is never counted as sleep. A session with no stages counts whole (older apps write
 * sessions without stages).
 */
export function hcSleepSamples(record: RecordResult<"SleepSession">): RawSample[] {
  const deviceName = origin(record);
  const stages = (record.stages ?? []).filter((s) => ASLEEP_STAGES.has(s.stage));
  if (stages.length === 0) {
    return [{ kind: "sleep", at: record.startTime, endAt: record.endTime, value: 0, externalId: id(record, `hc-sleep-${record.startTime}`), deviceName }];
  }
  return stages.map((s, i) => ({
    kind: "sleep" as const,
    at: s.startTime,
    endAt: s.endTime,
    value: 0,
    externalId: `${id(record, `hc-sleep-${record.startTime}`)}#${i}`,
    deviceName,
  }));
}

export function hcHeartRateSamples(record: RecordResult<"HeartRate">): RawSample[] {
  const deviceName = origin(record);
  const base = id(record, `hc-hr-${record.startTime}`);
  return (record.samples ?? []).map((s, i) => ({
    kind: "heart_rate" as const,
    at: s.time,
    value: s.beatsPerMinute,
    externalId: `${base}#${i}`,
    deviceName,
  }));
}

/** Glucose: Health Connect measures in mmol/L; the read result also carries mg/dL, which is what the vitals table stores. */
export function hcGlucoseSample(record: RecordResult<"BloodGlucose">): RawSample {
  return {
    kind: "glucose",
    at: record.time,
    value: Math.round(record.level.inMilligramsPerDeciliter),
    externalId: id(record, `hc-glucose-${record.time}`),
    deviceName: origin(record),
  };
}

export function hcBloodPressureSample(record: RecordResult<"BloodPressure">): RawSample {
  return {
    kind: "blood_pressure",
    at: record.time,
    value: record.systolic.inMillimetersOfMercury,
    value2: record.diastolic.inMillimetersOfMercury,
    externalId: id(record, `hc-bp-${record.time}`),
    deviceName: origin(record),
  };
}

export function hcSpo2Sample(record: RecordResult<"OxygenSaturation">): RawSample {
  return {
    kind: "spo2",
    at: record.time,
    value: record.percentage,
    externalId: id(record, `hc-spo2-${record.time}`),
    deviceName: origin(record),
  };
}

export function hcWeightSample(record: RecordResult<"Weight">): RawSample {
  return {
    kind: "weight",
    at: record.time,
    value: record.weight.inKilograms,
    externalId: id(record, `hc-weight-${record.time}`),
    deviceName: origin(record),
  };
}

export function hcRestingHeartRateSample(record: RecordResult<"RestingHeartRate">): RawSample {
  return {
    kind: "resting_hr",
    at: record.time,
    value: record.beatsPerMinute,
    externalId: id(record, `hc-rhr-${record.time}`),
    deviceName: origin(record),
  };
}
