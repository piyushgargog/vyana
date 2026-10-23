// apps/mobile/src/lib/health/types.ts
// The shape of the wearables sync (issue #326, ADR-073). Every source — Health Connect,
// HealthKit, the mock, a future BLE band — speaks these types, and only these: the database
// stores aggregates and spot readings, never a platform's raw records.
// Owner: Vaibhav Parmar

/** The metrics Vyana reads. Names match the permissions the connect screen asks for (#327). */
export type HealthMetric =
  | "steps"
  | "active_minutes"
  | "distance"
  | "sleep"
  | "resting_hr"
  | "heart_rate"
  | "spo2"
  | "blood_pressure"
  | "glucose"
  | "weight";

export const ALL_METRICS: readonly HealthMetric[] = [
  "steps",
  "active_minutes",
  "distance",
  "sleep",
  "resting_hr",
  "heart_rate",
  "spo2",
  "blood_pressure",
  "glucose",
  "weight",
];

/** How a permission request ended. `partial` names the metrics that were granted. */
export type PermissionResult = {
  state: "granted" | "denied" | "partial";
  granted: HealthMetric[];
};

/**
 * One day of activity, as the database stores it (daily_activity, #325) and as a source's
 * own totals report it. Nulls are honest gaps: a source that cannot give a field says so.
 */
export type DailyAggregate = {
  /** `yyyy-mm-dd` in the phone's own zone. */
  day: string;
  steps: number | null;
  activeMinutes: number | null;
  distanceM: number | null;
  sleepMinutes: number | null;
  restingHr: number | null;
  deviceName: string | null;
};

/** A single spot reading, as the database stores it (vitals, #325). Our units only. */
export type SpotReading = {
  type: "bp" | "sugar_random" | "weight" | "heart_rate" | "spo2";
  value: number;
  /** Diastolic for `bp`; null for everything else. */
  value2: number | null;
  unit: string;
  /** ISO instant the reading was taken. */
  measuredAt: string;
  /** The source's own id for the reading — the dedupe key of the sync. */
  externalId: string;
  deviceName: string | null;
};

/**
 * The unified record every source is translated into before aggregation. Our units only —
 * glucose in mg/dL, distance in metres, pressure in mmHg, weight in kg — a mapper converts
 * at the border (Health Connect reports glucose in mmol/L) so nothing downstream converts
 * again. Steps and distance are NOT samples: platforms dedupe overlapping records (a phone
 * and a watch counting the same walk) in their own totals, so they come via `readDaily`.
 */
export type RawSample = {
  kind: "heart_rate" | "resting_hr" | "sleep" | "spo2" | "blood_pressure" | "glucose" | "weight";
  /** ISO start instant. For sleep, the start of one asleep segment. */
  at: string;
  /** ISO end instant; sleep segments only. */
  endAt?: string;
  value: number;
  value2?: number | null;
  externalId: string;
  deviceName: string | null;
};

/** A source failure with a short code — the only thing a sync may report about an error. */
export class HealthSourceError extends Error {
  readonly code: "not_installed" | "permission_denied" | "unavailable" | "read_failed";
  constructor(code: HealthSourceError["code"], message: string) {
    super(message);
    this.name = "HealthSourceError";
    this.code = code;
  }
}

/**
 * One health store, behind one interface. Implementations are thin: they translate the
 * platform's records into the types above and nothing more — the thinking (which day a
 * night of sleep belongs to, what a resting heart rate is) lives in aggregate.ts, pure
 * and tested.
 */
export interface HealthSource {
  readonly id: "health_connect" | "healthkit";
  /** True when the store exists on this phone and can be opened. Never throws. */
  isAvailable(): Promise<boolean>;
  /** Asks for the given metrics; a refusal is a result, never a throw. */
  requestPermissions(metrics: readonly HealthMetric[]): Promise<PermissionResult>;
  /** The platform's own per-day totals for steps, active minutes and distance. */
  readDaily(from: Date, to: Date): Promise<DailyAggregate[]>;
  /** Individual records: sleep segments, heart rate, resting heart rate, spot readings. */
  readSamples(from: Date, to: Date): Promise<RawSample[]>;
}
