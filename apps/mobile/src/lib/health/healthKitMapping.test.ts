import { describe, expect, it } from "vitest";

import { hkBloodPressurePairs, hkQuantityToSample, hkSleepSamples } from "./healthKitMapping";

describe("hkQuantityToSample", () => {
  it("carries the sample uuid as the external id and the quantity as the value", () => {
    const out = hkQuantityToSample("glucose", { uuid: "hk-1", quantity: 96, startDate: new Date("2026-10-21T08:00:00.000Z"), deviceName: "Apple Watch" });
    expect(out).toEqual({ kind: "glucose", at: "2026-10-21T08:00:00.000Z", value: 96, externalId: "hk-1", deviceName: "Apple Watch" });
  });
});

describe("hkBloodPressurePairs", () => {
  it("pairs systolic and diastolic written at the same instant", () => {
    const out = hkBloodPressurePairs(
      [{ uuid: "sys-1", quantity: 122, startDate: "2026-10-21T09:00:00.000Z" }],
      [{ uuid: "dia-1", quantity: 81, startDate: "2026-10-21T09:00:00.000Z" }],
    );
    expect(out).toEqual([{ kind: "blood_pressure", at: "2026-10-21T09:00:00.000Z", value: 122, value2: 81, externalId: "sys-1", deviceName: null }]);
  });

  it("keeps a systolic whose diastolic partner is missing, with a null second value", () => {
    const out = hkBloodPressurePairs([{ uuid: "sys-2", quantity: 118, startDate: "2026-10-21T09:00:00.000Z" }], []);
    expect(out[0]?.value2).toBeNull();
  });
});

describe("hkSleepSamples", () => {
  it("keeps the asleep values (unspecified, core, deep, REM) and drops in-bed and awake", () => {
    const mk = (value: number, uuid: string) => ({ uuid, value, startDate: "2026-10-21T23:00:00.000Z", endDate: "2026-10-22T01:00:00.000Z" });
    const out = hkSleepSamples([mk(0, "a"), mk(1, "b"), mk(2, "c"), mk(3, "d"), mk(4, "e"), mk(5, "f")]);
    expect(out.map((s) => s.externalId)).toEqual(["b", "d", "e", "f"]);
  });
});
