import { describe, expect, it } from "vitest";

import {
  BLINKIT,
  BUCKETS,
  CAREGIVER_INVITE_TTL_HOURS,
  CONSENT_VERSION,
  DEFAULT_TIMES,
  EMERGENCY,
  EMERGENCY_NUMBER,
  MEAL_CALORIES_MAX,
  MEAL_DESCRIPTION_MAX,
  MEAL_TYPES,
  MISSED_DOSE_GRACE_MINUTES,
  ORS_URL,
  RATE_LIMITED_ROUTES,
  RATE_LIMITS,
  rateLimitOf,
  SHARE_LINK_MAX_TTL_HOURS,
  REALTIME,
  VITAL_UNITS,
} from "./constants";
import type { Tables, TablesInsert, TablesUpdate } from "./index";

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
  });

  it("exports the Indian national emergency ambulance number", () => {
    expect(EMERGENCY_NUMBER).toBe("108");
  });
});

describe("Scope v2 constants", () => {
  it("versions the consent text", () => {
    expect(CONSENT_VERSION).toBe("2026-10-11");
  });

  it("lists the emergency numbers and keeps EMERGENCY_NUMBER in step", () => {
    expect(EMERGENCY.ambulance).toBe("108");
    expect(EMERGENCY.all).toBe("112");
    expect(EMERGENCY.ambulance).toBe(EMERGENCY_NUMBER);
  });

  it("points the Blinkit button at blinkit.com with the Gurugram note", () => {
    expect(BLINKIT.url).toBe("https://blinkit.com");
    expect(BLINKIT.note).toContain("Gurugram");
  });

  it("links to the ORS portal", () => {
    expect(ORS_URL).toBe("https://ors.gov.in");
  });

  it("matches the caregiver invite lifetime used by create_care_invite()", () => {
    expect(CAREGIVER_INVITE_TTL_HOURS).toBe(24);
  });

  it("waits 60 minutes before a missed dose alert", () => {
    expect(MISSED_DOSE_GRACE_MINUTES).toBe(60);
  });

  it("keeps the meal log limits the database enforces (migration 0011)", () => {
    expect(MEAL_TYPES).toEqual(["breakfast", "lunch", "dinner", "snack"]);
    expect(MEAL_DESCRIPTION_MAX).toBe(200);
    expect(MEAL_CALORIES_MAX).toBe(5000);
  });

  it("keeps the per-user API limits of issue 138", () => {
    expect(RATE_LIMITS).toEqual({
      ai_chat: { windowSeconds: 600, max: 20 },
      ai_document: { windowSeconds: 3600, max: 10 },
      ai_other: { windowSeconds: 3600, max: 20 },
      agent: { windowSeconds: 3600, max: 10 },
      public: { windowSeconds: 600, max: 30 },
    });
    expect(rateLimitOf("agent")).toEqual({ bucket: "agent", windowSeconds: 3600, max: 10 });
  });

  it("limits the routes that start AI or web-agent work, and never SOS or the polling of a job", () => {
    expect(Object.keys(RATE_LIMITED_ROUTES).sort()).toEqual([
      "assistant/chat", "blood/search", "care-plan", "doctors/verify", "emergency/nearby", "hospitals/info", "labs/compare",
      "medicines/interactions", "prescriptions/basket", "prescriptions/extract", "reports/analyze", "schemes/pmjay-hospitals", "triage",
    ]);
    expect(RATE_LIMITED_ROUTES["emergency/sos"]).toBeUndefined();
    for (const bucket of Object.values(RATE_LIMITED_ROUTES)) expect(RATE_LIMITS[bucket]).toBeDefined();
  });

  it("lets a share link live 30 days at most", () => {
    expect(SHARE_LINK_MAX_TTL_HOURS).toBe(720);
  });
});

describe("Database types", () => {
  it("exports the generated Tables helpers from the package root", () => {
    // Compile-time check: if `Tables` were ambiguous through `export *`, this file would not type-check.
    const profile: Tables<"profiles"> | null = null;
    const insert: TablesInsert<"consents"> = { user_id: "u", version: CONSENT_VERSION };
    const update: TablesUpdate<"profiles"> = { onboarded: true };
    expect(profile).toBeNull();
    expect(insert.version).toBe(CONSENT_VERSION);
    expect(update.onboarded).toBe(true);
  });
});
