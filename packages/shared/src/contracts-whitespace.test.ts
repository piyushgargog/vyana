import { describe, expect, it } from "vitest";

import {
  AdminDoctorCheckReq,
  BloodRequest,
  BloodSearchReq,
  EmergencySosReq,
  JoinWaitlistReq,
  TriageReq,
} from "./contracts";

const bloodRequest = (overrides: Record<string, unknown> = {}) => ({
  id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4",
  blood_group: "B-",
  component: "red_cells",
  units: 2,
  hospital_name: "Fortis Hospital",
  city: "Noida",
  contact_name: "Rukhsana Khan",
  contact_phone: "+91 00000 00002",
  status: "searching",
  note: null,
  created_at: "2026-11-09T00:00:00Z",
  updated_at: "2026-11-09T00:00:00Z",
  ...overrides,
});

const adminCheck = (note: string) => ({
  doctor_id: "00000000-0000-4000-8000-000000000001",
  decision: "approve",
  reg_no: "12345",
  state_council: "Delhi Medical Council",
  year: null,
  note,
});

describe("whitespace-only contract strings", () => {
  it("rejects a whitespace-only triage symptoms value and trims a padded one", () => {
    expect(TriageReq.safeParse({ symptoms: "   " }).success).toBe(false);
    const parsed = TriageReq.safeParse({ symptoms: "  fever  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.symptoms).toBe("fever");
  });

  it("trims an optional triage duration to empty", () => {
    const parsed = TriageReq.safeParse({ symptoms: "fever", duration: "   " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.duration).toBe("");
  });

  it("rejects a whitespace-only blood search city and trims a padded one", () => {
    expect(BloodSearchReq.safeParse({ blood_group: "B-", component: "red_cells", city: "  " }).success).toBe(false);
    const parsed = BloodSearchReq.safeParse({ blood_group: "B-", component: "red_cells", city: "  Noida  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.city).toBe("Noida");
  });

  it("rejects a whitespace-only value in every trimmed blood request field", () => {
    for (const field of ["hospital_name", "city", "contact_name", "contact_phone"]) {
      expect(BloodRequest.safeParse(bloodRequest({ [field]: "  " })).success).toBe(false);
    }
    const parsed = BloodRequest.safeParse(bloodRequest({ hospital_name: "  Fortis Hospital  " }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.hospital_name).toBe("Fortis Hospital");
  });

  it("trims an optional SOS note to empty and still accepts no note", () => {
    const parsed = EmergencySosReq.safeParse({ lat: 28.6, lng: 77.2, note: "   " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBe("");
    expect(EmergencySosReq.safeParse({ lat: 28.6, lng: 77.2 }).success).toBe(true);
  });

  it("rejects a whitespace-only admin doctor check note", () => {
    expect(AdminDoctorCheckReq.safeParse(adminCheck("   ")).success).toBe(false);
    const parsed = AdminDoctorCheckReq.safeParse(adminCheck("  checked  "));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBe("checked");
  });

  it("trims an optional waitlist note to empty and still accepts no note", () => {
    const parsed = JoinWaitlistReq.safeParse({ email: "person@example.com", note: "   " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.note).toBe("");
    expect(JoinWaitlistReq.safeParse({ email: "person@example.com" }).success).toBe(true);
  });
});
