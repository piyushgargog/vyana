import { describe, expect, it } from "vitest";
import { AdminDoctorCheckReq, DoctorVerifyReq, currentRegistrationYear } from "./contracts";

const verify = (year: number) => DoctorVerifyReq.safeParse({ reg_no: "12345", state_council: "Delhi Medical Council", year_of_registration: year }).success;
const admin = (year: number | null) =>
  AdminDoctorCheckReq.safeParse({
    doctor_id: "00000000-0000-4000-8000-000000000001",
    decision: "approve",
    reg_no: "12345",
    state_council: "Delhi Medical Council",
    year,
    note: "checked",
  }).success;

describe("registration year", () => {
  const now = currentRegistrationYear();
  it("accepts 1950 and the current year", () => {
    for (const ok of [verify, admin]) {
      expect(ok(1950)).toBe(true);
      expect(ok(now)).toBe(true);
    }
  });
  it("rejects the next year and 1949", () => {
    for (const ok of [verify, admin]) {
      expect(ok(now + 1)).toBe(false);
      expect(ok(1949)).toBe(false);
    }
  });
  it("still accepts no year on the doctor path and null on the admin path", () => {
    expect(DoctorVerifyReq.safeParse({ reg_no: "1", state_council: "Delhi" }).success).toBe(true);
    expect(admin(null)).toBe(true);
  });
  it("the current year is the India calendar year", () => {
    const ist = Number(new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 4));
    expect(now).toBe(ist);
  });
});

describe("state council bound", () => {
  it("doctor and admin paths both cap state_council at 80 characters", () => {
    const ok = "C".repeat(80);
    const tooLong = "C".repeat(81);
    expect(DoctorVerifyReq.safeParse({ reg_no: "1", state_council: ok }).success).toBe(true);
    expect(DoctorVerifyReq.safeParse({ reg_no: "1", state_council: tooLong }).success).toBe(false);
    expect(
      AdminDoctorCheckReq.safeParse({
        doctor_id: "00000000-0000-4000-8000-000000000001",
        decision: "approve",
        reg_no: "1",
        state_council: tooLong,
        year: null,
        note: "checked",
      }).success,
    ).toBe(false);
  });
});
