import type { HospitalInfoRes } from "../contracts";

// Mock OPD info. Real timings must appear on the fetched source page (plan §2A).
export const hospitalInfoMock: HospitalInfoRes = {
  hospital_id: "c383fff5-32d7-409d-954e-f469221d1ee2",
  opd: [
    { department: "General Medicine", days: "Mon–Sat", timings: "8:00 AM – 1:00 PM (registration)" },
    { department: "Dermatology", days: "Mon, Wed, Fri", timings: "9:00 AM – 12:00 PM" },
    { department: "Cardiology", days: "Tue, Thu", timings: "9:00 AM – 12:00 PM" },
  ],
  notes: "Sample OPD information for building the screen.",
  source_url: null,
  fetched_at: "2026-10-12T08:30:00.000Z",
  cached: true,
};
