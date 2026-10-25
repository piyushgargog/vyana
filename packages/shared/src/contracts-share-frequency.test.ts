import { describe, expect, it } from "vitest";

import { ShareRes } from "./contracts";

// Share frequencies were typed as a free string while the prescription contract
// and the DB check hold them to the 7-value enum (OD, BD, TDS, QID, HS, SOS,
// custom). A first responder reading a shared card should get the same guarantee.
const base = {
  kind: "medical_id",
  profile: {
    full_name: "Test Patient",
    age: 40,
    blood_group: "O+",
    allergies: [],
    conditions: [],
    active_medicines: [{ name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD" }],
    emergency_contacts: [],
  },
  timeline: null,
  memory: null,
  expires_at: "2027-01-01T00:00:00.000Z",
} as const;

describe("share frequency enum", () => {
  it("accepts a prescription-enum frequency on the medical ID", () => {
    expect(ShareRes.safeParse(base).success).toBe(true);
  });

  it("rejects a free-text frequency on the medical ID", () => {
    const bad = { ...base, profile: { ...base.profile, active_medicines: [{ name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "twice daily" }] } };
    expect(ShareRes.safeParse(bad).success).toBe(false);
  });

  it("rejects a free-text frequency in the memory medicines", () => {
    const bad = {
      ...base,
      memory: {
        medicines: [{ name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "twice daily", start: "2022-01-15", end: null }],
      },
    };
    expect(ShareRes.safeParse(bad).success).toBe(false);
  });
});
