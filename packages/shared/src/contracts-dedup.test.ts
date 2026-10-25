import { describe, expect, it } from "vitest";

import { MEAL_TYPES } from "./constants";
import { CarePlan, CarePlanMeal, DeviceMetric, EmergencyContact, EmergencySosRes, LabFlag, LabValue, ShareMemory, SharedProfile } from "./contracts";
import { ALL_DEVICE_METRICS } from "./devices";

const labValue = (flag: string) => ({
  test_name: "HbA1c",
  value: 7.4,
  value_text: null,
  unit: "%",
  ref_low: 4,
  ref_high: 5.6,
  flag,
});

const shareLabs = (flag: string) => ({
  labs: [{ test_name: "HbA1c", unit: "%", ref_low: 4, ref_high: 5.6, points: [{ date: "2026-01-12", value: 7.4, flag }] }],
});

const carePlan = (meal: string) => ({
  condition: "test",
  summary: "test",
  do: [],
  dont: [],
  diet: { eat_more: [], limit: [], sample_day: [{ meal, items: [] }] },
  red_flags: [],
  follow_up_tests: [],
  sources: [],
  language: "en",
});

describe("shared enums and shapes used in more than one contract", () => {
  it("LabFlag holds exactly the four lab flags both lab shapes accept", () => {
    expect([...LabFlag.options]).toEqual(["low", "normal", "high", "unknown"]);
    for (const flag of ["low", "normal", "high", "unknown"]) {
      expect(LabValue.safeParse(labValue(flag)).success).toBe(true);
      expect(ShareMemory.safeParse(shareLabs(flag)).success).toBe(true);
    }
    expect(LabValue.safeParse(labValue("bogus")).success).toBe(false);
    expect(ShareMemory.safeParse(shareLabs("bogus")).success).toBe(false);
  });

  it("EmergencyContact is the one contact shape both profiles accept", () => {
    expect(EmergencySosRes.safeParse({
      request_id: "00000000-0000-4000-8000-000000000001",
      status: "requested",
      eta_minutes: 10,
      hospitals: [],
      contacts: [{ name: "Ravi", phone: "+91 90000 00001" }],
      sms_body: "help",
    }).success).toBe(true);
    expect(SharedProfile.safeParse({
      full_name: null,
      age: null,
      blood_group: null,
      allergies: [],
      conditions: [],
      active_medicines: [],
      emergency_contacts: [{ name: "Ravi", phone: "+91 90000 00001" }],
    }).success).toBe(true);
    expect(EmergencyContact.safeParse({ name: "Ravi" }).success).toBe(false);
  });

  it("the care-plan meal is exactly the shared meal list", () => {
    // CarePlanMeal deliberately lives in the contracts, not as an import of MEAL_TYPES (see the
    // comment on it): this test is what pins the two lists to each other, so a drift fails here.
    expect([...CarePlanMeal.options]).toEqual([...MEAL_TYPES]);
    for (const meal of MEAL_TYPES) {
      expect(CarePlan.safeParse(carePlan(meal)).success).toBe(true);
    }
    expect(CarePlan.safeParse(carePlan("brunch")).success).toBe(false);
  });

  it("the device metric list is exactly the DeviceMetric enum", () => {
    expect(ALL_DEVICE_METRICS).toEqual([...DeviceMetric.options]);
  });
});
