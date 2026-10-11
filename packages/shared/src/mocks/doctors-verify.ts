import type { DoctorVerifyRes } from "../contracts";

export const doctorsVerifyMock: DoctorVerifyRes = {
  status: "verified",
  match: { name: "Dr. Ananya Kapoor", reg_no: "00000", state_council: "Delhi Medical Council", year_of_registration: 2015 },
  checked_at: "2026-10-12T10:00:00.000Z",
};
