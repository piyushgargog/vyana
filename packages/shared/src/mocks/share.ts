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
