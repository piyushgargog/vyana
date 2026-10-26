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
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];
export type VitalType = keyof typeof VITAL_UNITS;

export const EMERGENCY_NUMBER = "108";

// Scope v2 additions (plan 7.5)
export const CONSENT_VERSION = "2026-10-23";
export const EMERGENCY = { ambulance: "108", all: "112" } as const; // EMERGENCY_NUMBER stays for compatibility
export const BLINKIT = {
  url: "https://blinkit.com",
  note: "Blinkit Ambulance is available in parts of Gurugram",
} as const;
export const ORS_URL = "https://ors.gov.in";
export const CAREGIVER_INVITE_TTL_HOURS = 24;
export const MISSED_DOSE_GRACE_MINUTES = 60;
/** A share link can be valid for at most this long; the database refuses a longer one (migration 0009). */
export const SHARE_LINK_MAX_TTL_HOURS = 30 * 24;

// Meal log (T3). The database holds the same limits (migration 0011).
export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];
export const MEAL_DESCRIPTION_MAX = 200;
/** The most calories one entry may have: a typo like 3000000 is refused instead of ruining a day's total. */
export const MEAL_CALORIES_MAX = 5000;

// Per-user limits on the AI and web-agent routes (issue #138). The counters are in the database (migration 0012,
// `hit_rate_limit`); the API checks them after the sign-in check and before any model or web-agent call.
export const RATE_LIMITS = {
  /** The assistant chat. */
  ai_chat: { windowSeconds: 10 * 60, max: 20 },
  /** Reading a prescription or a lab report (a vision model); correcting a value of a report shares this envelope. */
  ai_document: { windowSeconds: 60 * 60, max: 10 },
  /** Care plan, symptom check and interaction check. */
  ai_other: { windowSeconds: 60 * 60, max: 20 },
  /** Anything that starts a web agent or a live-web search for the user. */
  agent: { windowSeconds: 60 * 60, max: 10 },
  /** Reading a public source for the user (blood bank stock): cached, cheap, but polite to the source. */
  lookup: { windowSeconds: 10 * 60, max: 20 },
  /** Nearby emergency hospitals. SOS itself is never limited. */
  public: { windowSeconds: 10 * 60, max: 30 },
  /** Downloading your own data: the heaviest read in the app, so a low envelope — a real download is one or two calls. */
  data_export: { windowSeconds: 60 * 60, max: 5 },
} as const;
export type RateLimitBucket = keyof typeof RATE_LIMITS;

/** A bucket with its name, for `withRoute`'s `rateLimit` option. */
export const rateLimitOf = (bucket: RateLimitBucket) => ({ bucket, ...RATE_LIMITS[bucket] });

/** Which routes (without `/api/`) are limited, and in which bucket. The routes that start a job (blood search) are limited; polling a job is not. */
export const RATE_LIMITED_ROUTES: Record<string, RateLimitBucket> = {
  "assistant/chat": "ai_chat",
  "prescriptions/extract": "ai_document",
  "reports/analyze": "ai_document",
  "reports/values/correct": "ai_document",
  "care-plan": "ai_other",
  triage: "ai_other",
  "medicines/interactions": "ai_other",
  "blood/search": "lookup",
  "doctors/verify": "lookup",
  "emergency/nearby": "public",
  "me/export": "data_export",
};
