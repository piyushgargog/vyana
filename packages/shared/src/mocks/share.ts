import type { ShareRes } from "../contracts";

// Fictional patient for the public share page.
export const shareMock: ShareRes = {
  kind: "timeline",
  profile: {
    full_name: "Aarav Mehta",
    age: 52,
    blood_group: "O+",
    allergies: ["Penicillin"],
    conditions: ["Type 2 Diabetes", "Hypertension"],
    active_medicines: [
      { name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD" },
      { name: "Telma", strength: "40 mg", dose: "1 tablet", frequency: "OD" },
    ],
    emergency_contacts: [{ name: "Ravi (brother)", phone: "+91 90000 00001" }],
  },
  timeline: [
    { date: "2026-10-12", kind: "prescription", title: "Prescription from Dr. Ananya Kapoor", summary: "3 medicines" },
    { date: "2026-10-10", kind: "report", title: "Lab report: Sample Diagnostics", summary: "HbA1c 7.4% (high)" },
    { date: "2026-09-28", kind: "appointment", title: "General Medicine, token 14", summary: null },
    { date: "2022-01-15", kind: "condition", title: "Type 2 Diabetes", summary: null },
  ],
  memory: null,
  expires_at: "2026-10-13T09:00:00.000Z",
};

/** The same fictional patient with a Memory Graph link (all four scopes on). */
export const shareMemoryMock: ShareRes = {
  ...shareMock,
  memory: {
    labs: [
      {
        test_name: "HbA1c", unit: "%", ref_low: 4, ref_high: 5.6,
        points: [
          { date: "2026-01-12", value: 8.1, flag: "high" },
          { date: "2026-04-10", value: 7.8, flag: "high" },
          { date: "2026-07-14", value: 7.6, flag: "high" },
          { date: "2026-10-10", value: 7.4, flag: "high" },
        ],
      },
    ],
    vitals: [
      {
        type: "blood_pressure", unit: "mmHg",
        points: [
          { at: "2026-10-01T08:00:00.000Z", value: 142, value2: 90 },
          { at: "2026-10-08T08:00:00.000Z", value: 138, value2: 88 },
        ],
      },
    ],
    medicines: [
      { name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD", start: "2022-01-15", end: null },
      { name: "Telma", strength: "40 mg", dose: "1 tablet", frequency: "OD", start: "2024-03-02", end: null },
    ],
    adherence: {
      days: [
        { date: "2026-10-10", taken: 3, missed: 0, skipped: 0 },
        { date: "2026-10-11", taken: 2, missed: 1, skipped: 0 },
        { date: "2026-10-12", taken: 3, missed: 0, skipped: 0 },
      ],
      percent_taken: 89,
    },
  },
};
