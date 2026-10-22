// apps/mobile/src/lib/health/healthKit.ts
// The HealthKit source (iOS, issue #326): a thin wrapper over
// @kingstinct/react-native-healthkit. Translation lives in healthKitMapping.ts (pure,
// tested); this file only talks to the platform, asking for our units at query time
// (mg/dL, metres, minutes) so nothing downstream converts. Needs the native build —
// Piyush's app.json plugins; until then isAvailable() answers false and the app runs
// on the mock.
// Owner: Vaibhav Parmar

import {
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryQuantitySamples,
  queryStatisticsCollectionForQuantity,
  requestAuthorization,
  type CategorySample,
  type QuantitySample,
} from "@kingstinct/react-native-healthkit";

import { dayKey, startOfDay } from "./aggregate";
import { hkBloodPressurePairs, hkQuantityToSample, hkSleepSamples, type HkCategorySampleLike, type HkQuantitySampleLike } from "./healthKitMapping";
import { HealthSourceError, type DailyAggregate, type HealthMetric, type HealthSource, type PermissionResult, type RawSample } from "./types";

const QUANTITY_FOR: Partial<Record<HealthMetric, string>> = {
  steps: "HKQuantityTypeIdentifierStepCount",
  active_minutes: "HKQuantityTypeIdentifierAppleExerciseTime",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  resting_hr: "HKQuantityTypeIdentifierRestingHeartRate",
  heart_rate: "HKQuantityTypeIdentifierHeartRate",
  spo2: "HKQuantityTypeIdentifierOxygenSaturation",
  glucose: "HKQuantityTypeIdentifierBloodGlucose",
  weight: "HKQuantityTypeIdentifierBodyMass",
};
const SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const BP_SYSTOLIC = "HKQuantityTypeIdentifierBloodPressureSystolic";
const BP_DIASTOLIC = "HKQuantityTypeIdentifierBloodPressureDiastolic";

const dateFilter = (from: Date, to: Date) => ({ filter: { date: { startDate: from, endDate: to } } });

function quantityLike(s: QuantitySample): HkQuantitySampleLike {
  return {
    uuid: s.uuid,
    quantity: s.quantity,
    startDate: s.startDate,
    endDate: s.endDate,
    deviceName: s.device?.name ?? s.sourceRevision?.source?.name ?? null,
  };
}

function categoryLike(s: CategorySample): HkCategorySampleLike {
  return {
    uuid: s.uuid,
    value: s.value,
    startDate: s.startDate,
    endDate: s.endDate,
    deviceName: s.device?.name ?? s.sourceRevision?.source?.name ?? null,
  };
}

export class HealthKitSource implements HealthSource {
  readonly id = "healthkit" as const;

  async isAvailable(): Promise<boolean> {
    try {
      return await isHealthDataAvailableAsync();
    } catch {
      return false;
    }
  }

  async requestPermissions(metrics: readonly HealthMetric[]): Promise<PermissionResult> {
    if (!(await this.isAvailable())) return { state: "denied", granted: [] };
    const read: string[] = [];
    for (const m of metrics) {
      if (m === "sleep") read.push(SLEEP_TYPE);
      else if (m === "blood_pressure") read.push(BP_SYSTOLIC, BP_DIASTOLIC);
      else if (QUANTITY_FOR[m]) read.push(QUANTITY_FOR[m]);
    }
    // HealthKit never tells an app whether READ access was granted — the request
    // resolving only means the person was asked. A completed request is reported as
    // granted; a person who said no is found later, as empty reads, not as an error.
    const asked = await requestAuthorization({ toRead: read as never, toShare: [] });
    return asked ? { state: "granted", granted: [...metrics] } : { state: "denied", granted: [] };
  }

  async readDaily(from: Date, to: Date): Promise<DailyAggregate[]> {
    if (!(await this.isAvailable())) throw new HealthSourceError("not_installed", "HealthKit is not available");
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const byDay = new Map<string, DailyAggregate>();
    const ensure = (day: string): DailyAggregate => {
      const row = byDay.get(day) ?? { day, steps: null, activeMinutes: null, distanceM: null, sleepMinutes: null, restingHr: null, deviceName: null };
      byDay.set(day, row);
      return row;
    };
    // The collection is anchored at local midnight of the first day: anchored at a
    // time of day, its "days" would be 24-hour windows running from that time, and a
    // bucket would land on the wrong calendar day.
    const anchor = startOfDay(from, timeZone);
    const collect = async (identifier: string, unit: string, apply: (row: DailyAggregate, value: number) => void) => {
      const stats = await queryStatisticsCollectionForQuantity(identifier as never, ["cumulativeSum"], anchor, { day: 1 }, { ...dateFilter(anchor, to), unit: unit as never });
      for (const s of stats) {
        if (s.sumQuantity && s.startDate) apply(ensure(dayKey(s.startDate, timeZone)), s.sumQuantity.quantity);
      }
    };
    await collect(QUANTITY_FOR.steps!, "count", (row, v) => (row.steps = Math.round(v)));
    await collect(QUANTITY_FOR.distance!, "m", (row, v) => (row.distanceM = Math.round(v)));
    await collect(QUANTITY_FOR.active_minutes!, "min", (row, v) => (row.activeMinutes = Math.round(v)));
    return [...byDay.values()];
  }

  async readSamples(from: Date, to: Date): Promise<RawSample[]> {
    if (!(await this.isAvailable())) throw new HealthSourceError("not_installed", "HealthKit is not available");
    const opts = dateFilter(from, to);
    // limit 0 = every sample in the window (the library's own convention).
    const [hr, resting, spo2Raw, glucose, weight, systolic, diastolic, sleep] = await Promise.all([
      queryQuantitySamples(QUANTITY_FOR.heart_rate as never, { ...opts, limit: 0, unit: "count/min" as never }),
      queryQuantitySamples(QUANTITY_FOR.resting_hr as never, { ...opts, limit: 0, unit: "count/min" as never }),
      queryQuantitySamples(QUANTITY_FOR.spo2 as never, { ...opts, limit: 0, unit: "%" as never }),
      queryQuantitySamples(QUANTITY_FOR.glucose as never, { ...opts, limit: 0, unit: "mg/dL" as never }),
      queryQuantitySamples(QUANTITY_FOR.weight as never, { ...opts, limit: 0, unit: "kg" as never }),
      queryQuantitySamples(BP_SYSTOLIC as never, { ...opts, limit: 0, unit: "mmHg" as never }),
      queryQuantitySamples(BP_DIASTOLIC as never, { ...opts, limit: 0, unit: "mmHg" as never }),
      queryCategorySamples(SLEEP_TYPE as never, { ...opts, limit: 0 }),
    ]);
    return [
      ...hr.map((s) => hkQuantityToSample("heart_rate", quantityLike(s))),
      ...resting.map((s) => hkQuantityToSample("resting_hr", quantityLike(s))),
      // HealthKit's percent unit is a fraction: 0.98 means 98%. Normalised here, where
      // the unit was chosen, so the rest of the sync only ever sees 0–100.
      ...spo2Raw.map((s) => {
        const like = quantityLike(s);
        return hkQuantityToSample("spo2", { ...like, quantity: like.quantity <= 1.5 ? like.quantity * 100 : like.quantity });
      }),
      ...glucose.map((s) => hkQuantityToSample("glucose", quantityLike(s))),
      ...weight.map((s) => hkQuantityToSample("weight", quantityLike(s))),
      ...hkBloodPressurePairs(systolic.map(quantityLike), diastolic.map(quantityLike)),
      ...hkSleepSamples(sleep.map(categoryLike)),
    ];
  }
}
