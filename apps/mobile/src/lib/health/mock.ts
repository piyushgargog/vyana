// apps/mobile/src/lib/health/mock.ts
// A deterministic health source (issue #326): the same fixtures on every run, so the sync
// can be developed and tested without a phone, a watch or a permission dialog. Dates are
// derived from the (from, to) window a caller passes — the values never change.
// Owner: Vaibhav Parmar

import { HealthSourceError, type DailyAggregate, type HealthMetric, type HealthSource, type PermissionResult, type RawSample } from "./types";

const dayMs = 24 * 3600 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const at = (day: Date, h: number, m: number) => new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h, m)).toISOString();

export type MockOptions = {
  id?: HealthSource["id"];
  available?: boolean;
  permission?: PermissionResult["state"];
  /** Make the reads fail with this code (a denied permission, an unreadable store). */
  failReadsWith?: HealthSourceError["code"];
};

export class MockHealthSource implements HealthSource {
  readonly id: HealthSource["id"];
  private readonly available: boolean;
  private readonly permission: PermissionResult["state"];
  private readonly failReadsWith?: HealthSourceError["code"];

  constructor(opts: MockOptions = {}) {
    this.id = opts.id ?? "health_connect";
    this.available = opts.available ?? true;
    this.permission = opts.permission ?? "granted";
    this.failReadsWith = opts.failReadsWith;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async requestPermissions(metrics: readonly HealthMetric[]): Promise<PermissionResult> {
    if (this.permission === "granted") return { state: "granted", granted: [...metrics] };
    if (this.permission === "partial") return { state: "partial", granted: metrics.slice(0, 3) };
    return { state: "denied", granted: [] };
  }

  private guardReads(): void {
    if (this.failReadsWith) throw new HealthSourceError(this.failReadsWith, `mock read failed: ${this.failReadsWith}`);
  }

  async readDaily(from: Date, to: Date): Promise<DailyAggregate[]> {
    this.guardReads();
    const rows: [number, number, number, number][] = [
      // [days before `to`, steps, active minutes, distance m]
      [2, 6_400, 25, 4_100],
      [1, 8_010, 32, 5_300],
      [0, 1_250, 8, 800],
    ];
    return rows
      .map(([back, steps, activeMinutes, distanceM]) => {
        const day = new Date(to.getTime() - back * dayMs);
        return { day: isoDay(day), steps, activeMinutes, distanceM, sleepMinutes: null, restingHr: null, deviceName: "Mock Watch" };
      })
      .filter((r) => r.day >= isoDay(from));
  }

  async readSamples(from: Date, to: Date): Promise<RawSample[]> {
    this.guardReads();
    const today = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
    const yesterday = new Date(today.getTime() - dayMs);
    const twoDaysAgo = new Date(today.getTime() - 2 * dayMs);
    const all: RawSample[] = [
      { kind: "sleep", at: at(yesterday, 23, 12), endAt: at(today, 6, 24), value: 0, externalId: "mock-sleep-1", deviceName: "Mock Watch" },
      { kind: "resting_hr", at: at(today, 7, 0), value: 59, externalId: "mock-rest-1", deviceName: "Mock Watch" },
      { kind: "heart_rate", at: at(yesterday, 10, 0), value: 78, externalId: "mock-hr-1", deviceName: "Mock Watch" },
      { kind: "heart_rate", at: at(yesterday, 10, 3), value: 82, externalId: "mock-hr-2", deviceName: "Mock Watch" },
      { kind: "heart_rate", at: at(yesterday, 10, 7), value: 64, externalId: "mock-hr-3", deviceName: "Mock Watch" },
      { kind: "spo2", at: at(yesterday, 9, 15), value: 98, externalId: "mock-spo2-1", deviceName: "Mock Watch" },
      { kind: "blood_pressure", at: at(yesterday, 9, 16), value: 118, value2: 76, externalId: "mock-bp-1", deviceName: "Mock Watch" },
      { kind: "glucose", at: at(yesterday, 8, 2), value: 96, externalId: "mock-glucose-1", deviceName: "Mock Watch" },
      { kind: "weight", at: at(twoDaysAgo, 7, 30), value: 70.4, externalId: "mock-weight-1", deviceName: "Mock Watch" },
    ];
    return all.filter((s) => s.at >= from.toISOString());
  }
}
