// apps/mobile/src/lib/health/healthConnect.ts
// The Health Connect source (Android, issue #326): a thin wrapper over
// react-native-health-connect. All translation lives in healthConnectMapping.ts (pure,
// tested); this file only talks to the platform. Needs the native build — Piyush's
// app.json plugins; until then isAvailable() simply answers false where the module is
// absent, and the app runs on the mock.
// Owner: Vaibhav Parmar

import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type RecordType,
} from "react-native-health-connect";

import { dayKey } from "./aggregate";
import {
  hcBloodPressureSample,
  hcGlucoseSample,
  hcHeartRateSamples,
  hcRestingHeartRateSample,
  hcSleepSamples,
  hcSpo2Sample,
  hcWeightSample,
} from "./healthConnectMapping";
import { HealthSourceError, type DailyAggregate, type HealthMetric, type HealthSource, type PermissionResult, type RawSample } from "./types";

/** The records each metric needs. `active_minutes` has no record in the agreed list (ADR-073), so it is never granted here. */
const METRIC_RECORDS: Record<HealthMetric, RecordType[]> = {
  steps: ["Steps"],
  active_minutes: [],
  distance: ["Distance"],
  sleep: ["SleepSession"],
  resting_hr: ["RestingHeartRate"],
  heart_rate: ["HeartRate"],
  spo2: ["OxygenSaturation"],
  blood_pressure: ["BloodPressure"],
  glucose: ["BloodGlucose"],
  weight: ["Weight"],
};

let initPromise: Promise<boolean> | null = null;
function ensureInit(): Promise<boolean> {
  initPromise ??= initialize().catch(() => false);
  return initPromise;
}

const rangeOf = (from: Date, to: Date) => ({ operator: "between" as const, startTime: from.toISOString(), endTime: to.toISOString() });

export class HealthConnectSource implements HealthSource {
  readonly id = "health_connect" as const;

  async isAvailable(): Promise<boolean> {
    try {
      return (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE && (await ensureInit());
    } catch {
      return false;
    }
  }

  async requestPermissions(metrics: readonly HealthMetric[]): Promise<PermissionResult> {
    if (!(await this.isAvailable())) return { state: "denied", granted: [] };
    const wanted = new Map<RecordType, HealthMetric>();
    for (const m of metrics) for (const r of METRIC_RECORDS[m]) wanted.set(r, m);
    if (wanted.size > 0) {
      await requestPermission([...wanted.keys()].map((recordType) => ({ recordType, accessType: "read" as const })));
    }
    const grantedNow = new Set(
      (await getGrantedPermissions()).filter((p) => "recordType" in p && p.accessType === "read").map((p) => (p as { recordType: RecordType }).recordType),
    );
    const granted = metrics.filter((m) => METRIC_RECORDS[m].length > 0 && METRIC_RECORDS[m].every((r) => grantedNow.has(r)));
    return { state: granted.length === 0 ? "denied" : granted.length === metrics.filter((m) => METRIC_RECORDS[m].length > 0).length ? "granted" : "partial", granted };
  }

  async readDaily(from: Date, to: Date): Promise<DailyAggregate[]> {
    if (!(await ensureInit())) throw new HealthSourceError("not_installed", "Health Connect is not available");
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const range = rangeOf(from, to);
    const [steps, distance] = await Promise.all([
      aggregateGroupByPeriod({ recordType: "Steps", timeRangeFilter: range, timeRangeSlicer: { period: "DAYS", length: 1 } }),
      aggregateGroupByPeriod({ recordType: "Distance", timeRangeFilter: range, timeRangeSlicer: { period: "DAYS", length: 1 } }),
    ]);
    const byDay = new Map<string, DailyAggregate>();
    const ensure = (day: string): DailyAggregate => {
      const row = byDay.get(day) ?? { day, steps: null, activeMinutes: null, distanceM: null, sleepMinutes: null, restingHr: null, deviceName: null };
      byDay.set(day, row);
      return row;
    };
    for (const g of steps) {
      const row = ensure(dayKey(g.startTime, timeZone));
      row.steps = g.result.COUNT_TOTAL;
      row.deviceName ??= g.result.dataOrigins[0] ?? null;
    }
    for (const g of distance) {
      const row = ensure(dayKey(g.startTime, timeZone));
      row.distanceM = Math.round(g.result.DISTANCE.inMeters);
      row.deviceName ??= g.result.dataOrigins[0] ?? null;
    }
    return [...byDay.values()];
  }

  async readSamples(from: Date, to: Date): Promise<RawSample[]> {
    if (!(await ensureInit())) throw new HealthSourceError("not_installed", "Health Connect is not available");
    const options = { timeRangeFilter: rangeOf(from, to) };
    const [sleep, hr, resting, spo2, bp, glucose, weight] = await Promise.all([
      readRecords("SleepSession", options),
      readRecords("HeartRate", options),
      readRecords("RestingHeartRate", options),
      readRecords("OxygenSaturation", options),
      readRecords("BloodPressure", options),
      readRecords("BloodGlucose", options),
      readRecords("Weight", options),
    ]);
    return [
      ...sleep.records.flatMap(hcSleepSamples),
      ...hr.records.flatMap(hcHeartRateSamples),
      ...resting.records.map(hcRestingHeartRateSample),
      ...spo2.records.map(hcSpo2Sample),
      ...bp.records.map(hcBloodPressureSample),
      ...glucose.records.map(hcGlucoseSample),
      ...weight.records.map(hcWeightSample),
    ];
  }
}
