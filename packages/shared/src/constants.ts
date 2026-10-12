// packages/shared/src/constants.ts
// Enums, bucket names, channel names and defaults shared by web and mobile (plan 7.1 and 7.5).
// Owner: Vaibhav Parmar

export const BUCKETS = {
  prescriptions: "prescriptions",
  labReports: "lab-reports",
} as const;

export type FrequencyType = "OD" | "BD" | "TDS" | "QID" | "HS" | "SOS" | "custom";

export const DEFAULT_TIMES: Record<FrequencyType, string[]> = {
  OD: ["09:00"],
  BD: ["09:00", "21:00"],
  TDS: ["08:00", "14:00", "20:00"],
  QID: ["08:00", "12:00", "16:00", "20:00"],
  HS: ["22:00"],
  SOS: [],
  custom: [],
};

export const VITAL_UNITS = {
  bp: "mmHg",
  sugar_fasting: "mg/dL",
  sugar_random: "mg/dL",
  weight: "kg",
  heart_rate: "bpm",
  spo2: "%",
  temperature: "°F",
} as const;

export const REALTIME = {
  emergency: (requestId: string) => `emergency:${requestId}`,
  appointmentsForDoctor: (doctorId: string) => `appointments:doctor:${doctorId}`,
  alertsForPatient: (patientId: string) => `alerts:${patientId}`,
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
export type VitalType = keyof typeof VITAL_UNITS;

export const EMERGENCY_NUMBER = "108";

// Scope v2 additions (plan 7.5)
export const CONSENT_VERSION = "2026-10-11";
export const EMERGENCY = { ambulance: "108", all: "112" } as const; // EMERGENCY_NUMBER stays for compatibility
export const BLINKIT = {
  url: "https://blinkit.com",
  note: "Blinkit Ambulance is available in parts of Gurugram",
} as const;
export const ORS_URL = "https://ors.gov.in";
export const CAREGIVER_INVITE_TTL_HOURS = 24;
export const MISSED_DOSE_GRACE_MINUTES = 60;
