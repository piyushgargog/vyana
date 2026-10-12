import { describe, expect, it } from "vitest";

import {
  BUCKETS,
  DEFAULT_TIMES,
  EMERGENCY_NUMBER,
  REALTIME,
  VITAL_UNITS,
} from "./constants";
import type { DbProfile, Profile } from "./db/types";

describe("Shared Constants", () => {
  it("defines standard storage bucket names", () => {
    expect(BUCKETS.prescriptions).toBe("prescriptions");
    expect(BUCKETS.labReports).toBe("lab-reports");
  });

  it("provides deterministic medication schedule defaults", () => {
    expect(DEFAULT_TIMES.OD).toEqual(["09:00"]);
    expect(DEFAULT_TIMES.BD).toEqual(["09:00", "21:00"]);
    expect(DEFAULT_TIMES.TDS).toEqual(["08:00", "14:00", "20:00"]);
    expect(DEFAULT_TIMES.QID).toEqual(["08:00", "12:00", "16:00", "20:00"]);
    expect(DEFAULT_TIMES.HS).toEqual(["22:00"]);
    expect(DEFAULT_TIMES.SOS).toEqual([]);
    expect(DEFAULT_TIMES.custom).toEqual([]);
  });

  it("maps vital types to their correct clinical units", () => {
    expect(VITAL_UNITS.bp).toBe("mmHg");
    expect(VITAL_UNITS.sugar_fasting).toBe("mg/dL");
    expect(VITAL_UNITS.sugar_random).toBe("mg/dL");
    expect(VITAL_UNITS.weight).toBe("kg");
    expect(VITAL_UNITS.heart_rate).toBe("bpm");
    expect(VITAL_UNITS.spo2).toBe("%");
    expect(VITAL_UNITS.temperature).toBe("°F");
  });

  it("formats realtime subscription channel identifiers properly", () => {
    expect(REALTIME.emergency("req-123")).toBe("emergency:req-123");
    expect(REALTIME.appointmentsForDoctor("doc-456")).toBe("appointments:doctor:doc-456");
    expect(REALTIME.alertsForPatient("pat-789")).toBe("alerts:pat-789");
  });

  it("exports official Indian national emergency ambulance number", () => {
    expect(EMERGENCY_NUMBER).toBe("108");
  });

  it("verifies Db-prefixed type equivalence", () => {
    // Compile-time check asserting DbProfile and Profile are identical types
    type IsIdentical<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;
    const isProfileIdentical: IsIdentical<DbProfile, Profile> = true;
    expect(isProfileIdentical).toBe(true);
  });
});
