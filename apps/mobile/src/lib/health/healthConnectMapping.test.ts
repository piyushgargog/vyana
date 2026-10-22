import { describe, expect, it } from "vitest";

import {
  hcBloodPressureSample,
  hcGlucoseSample,
  hcHeartRateSamples,
  hcRestingHeartRateSample,
  hcSleepSamples,
  hcSpo2Sample,
  hcWeightSample,
} from "./healthConnectMapping";

const meta = { id: "rec-1", dataOrigin: "Mi Fitness" };

describe("hcGlucoseSample", () => {
  it("lands in mg/dL — the unit the vitals table stores — not Health Connect's mmol/L", () => {
    const out = hcGlucoseSample({ time: "2026-10-21T08:00:00.000Z", level: { inMillimolesPerLiter: 5.4, inMilligramsPerDeciliter: 97 }, metadata: meta } as never);
    expect(out).toMatchObject({ kind: "glucose", value: 97, externalId: "rec-1", deviceName: "Mi Fitness" });
  });
});

describe("hcBloodPressureSample", () => {
  it("keeps systolic and diastolic in mmHg", () => {
    const bp = hcBloodPressureSample({ time: "2026-10-21T09:00:00.000Z", systolic: { inMillimetersOfMercury: 121 }, diastolic: { inMillimetersOfMercury: 79 }, metadata: meta } as never);
    expect(bp).toMatchObject({ kind: "blood_pressure", value: 121, value2: 79 });
  });
});

describe("the remaining spot samples", () => {
  it("weight arrives in kilograms, SpO2 as a percentage, resting heart rate as bpm", () => {
    expect(hcWeightSample({ time: "2026-10-21T07:00:00.000Z", weight: { inKilograms: 70.25 }, metadata: meta } as never)).toMatchObject({ kind: "weight", value: 70.25 });
    expect(hcSpo2Sample({ time: "2026-10-21T07:00:00.000Z", percentage: 97, metadata: meta } as never)).toMatchObject({ kind: "spo2", value: 97 });
    expect(hcRestingHeartRateSample({ time: "2026-10-21T07:00:00.000Z", beatsPerMinute: 58, metadata: meta } as never)).toMatchObject({ kind: "resting_hr", value: 58 });
  });
});

describe("hcSleepSamples", () => {
  it("keeps only the asleep stages — the awake stretch inside the night is not sleep", () => {
    const out = hcSleepSamples({
      startTime: "2026-10-21T23:00:00.000Z",
      endTime: "2026-10-22T06:00:00.000Z",
      stages: [
        { startTime: "2026-10-21T23:00:00.000Z", endTime: "2026-10-22T01:00:00.000Z", stage: 4 },
        { startTime: "2026-10-22T01:00:00.000Z", endTime: "2026-10-22T01:20:00.000Z", stage: 1 },
        { startTime: "2026-10-22T01:20:00.000Z", endTime: "2026-10-22T06:00:00.000Z", stage: 5 },
      ],
      metadata: meta,
    } as never);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ at: "2026-10-21T23:00:00.000Z", endAt: "2026-10-22T01:00:00.000Z" });
    expect(out[1]?.externalId).toBe("rec-1#1");
  });

  it("a session with no stages counts whole", () => {
    const out = hcSleepSamples({ startTime: "2026-10-21T23:00:00.000Z", endTime: "2026-10-22T06:00:00.000Z", metadata: meta } as never);
    expect(out).toHaveLength(1);
    expect(out[0]?.endAt).toBe("2026-10-22T06:00:00.000Z");
  });
});

describe("hcHeartRateSamples", () => {
  it("one sample per measurement inside the record, each with its own id", () => {
    const out = hcHeartRateSamples({
      startTime: "2026-10-21T10:00:00.000Z",
      endTime: "2026-10-21T10:10:00.000Z",
      samples: [
        { time: "2026-10-21T10:00:00.000Z", beatsPerMinute: 80 },
        { time: "2026-10-21T10:05:00.000Z", beatsPerMinute: 84 },
      ],
      metadata: meta,
    } as never);
    expect(out.map((s) => [s.at, s.value, s.externalId])).toEqual([
      ["2026-10-21T10:00:00.000Z", 80, "rec-1#0"],
      ["2026-10-21T10:05:00.000Z", 84, "rec-1#1"],
    ]);
  });
});
