// API contracts shared by the server routes and both clients.
// Field names are final: JSON over HTTP is snake_case, the same as the DB columns.
import { z } from "zod";

export const ErrorCode = z.enum(["UNAUTHORIZED","FORBIDDEN","BAD_REQUEST","NOT_FOUND","UPSTREAM_TIMEOUT","UPSTREAM_ERROR","INTERNAL","RATE_LIMITED"]);
export const ApiErrorBody = z.object({ error: z.object({ code: ErrorCode, message: z.string() }) });

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);       // YYYY-MM-DD
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);                  // HH:MM 24h

// ---------- AI accuracy & safety (plan §2A) ----------
export const Language = z.enum(["en","hi","hinglish"]);
// run_id: the ai_runs row, so "Report a mistake" can name it (CONTRACT CHANGED 14 Oct, ADR-063). null when it wasn't saved.
export const AiMeta = z.object({ model: z.string(), prompt_version: z.string(), generated_at: z.string(), run_id: z.guid().nullable().optional() });
// Extracted fields: `evidence` is the exact source text; `needs_review` is set when it can't be verified.
const aiReviewFields = { needs_review: z.boolean().optional(), evidence: z.string().nullable().optional() };

// ---------- shared pieces ----------
export const Hospital = z.object({
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  has_emergency: z.boolean().nullable(),
  has_icu: z.boolean().nullable(),
  maps_url: z.string(),                  // https://www.google.com/maps/search/?api=1&query=<encoded name+address>
  source_url: z.string().nullable(),
});

export const PrescriptionItem = z.object({
  id: z.guid(),
  medicine_name: z.string(),
  strength: z.string().nullable(),
  form: z.enum(["tablet","capsule","syrup","injection","drops","inhaler","other"]),
  dose: z.string().nullable(),
  frequency: z.enum(["OD","BD","TDS","QID","HS","SOS","custom"]),
  times: z.array(hhmm),
  with_food: z.enum(["before","after","any"]),
  duration_days: z.number().int().nullable(),
  start_date: isoDate,
  end_date: isoDate.nullable(),
  instructions: z.string().nullable(),
  ...aiReviewFields,
});

export const LabValue = z.object({
  id: z.guid().optional(),                            // CONTRACT CHANGED 13 Oct (ADR-062): the saved lab_values row
  test_name: z.string(),
  value: z.number().nullable(),
  value_text: z.string().nullable(),
  unit: z.string().nullable(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  flag: z.enum(["low","normal","high","unknown"]),
  ...aiReviewFields,
  corrected: z.boolean().optional(),                  // the patient corrected this value (ADR-062)
});

export const SourceLink = z.object({ title: z.string(), url: z.string() });

// ---------- POST /api/blood/search · GET /api/blood/search/{job_id} ----------  (RapidBlood, v1.1.0)
// A job like the blood search: POST starts it, poll GET while `status` is "running". Words in the UI are "listed",
// never "available": a row is what a public source page showed at `fetched_at`.
export const BloodGroup = z.enum(["A+","A-","B+","B-","AB+","AB-","O+","O-"]);
export const BloodComponent = z.enum(["whole_blood","red_cells","platelets","plasma"]);
export const BloodSearchReq = z.object({ blood_group: BloodGroup, component: BloodComponent, city: z.string().min(2).max(60) });
export const BloodBank = z.object({
  name: z.string(),
  address: z.string().nullable(),
  city: z.string(),
  phone: z.string().nullable(),
  units: z.number().int().min(0).nullable(),          // null when the source lists the bank but no stock number (plan B)
  component: z.string(),                              // as the source page names it
  source_url: z.string(),
  fetched_at: z.string(),                             // ISO datetime
  last_updated_text: z.string().nullable(),           // "updated" text copied from the source page
  verified: z.boolean(),                              // name and units were found on the fetched source page
});
export const BloodSearchSource = z.object({ area: z.string(), status: z.enum(["pending","ok","not_found","timeout","error"]) });
export const BloodSearchRes = z.object({
  job_id: z.string().min(1),
  query: z.string(), area: z.string(),
  banks: z.array(BloodBank),                          // verified first, then listed-only
  sources: z.array(BloodSearchSource),
  status: z.enum(["running","done"]),
  cached: z.boolean(),
});
// The request tracker (table blood_requests, owner-only). The patient sets every status; nothing changes it automatically.
export const BloodRequestStatus = z.enum(["searching","contacted","confirmed","arranged","received","cancelled"]);
export const BloodRequest = z.object({
  id: z.guid(),
  blood_group: BloodGroup,
  component: BloodComponent,
  units: z.number().int().min(1).max(10),
  hospital_name: z.string().min(2),
  city: z.string().min(2),
  contact_name: z.string().min(1),
  contact_phone: z.string().min(5),
  status: BloodRequestStatus,
  note: z.string().max(500).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ---------- POST /api/emergency/nearby ----------
const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);
export const EmergencyNearbyReq = z.object({ lat: Lat, lng: Lng });
export const EmergencyNearbyRes = z.object({ area: z.string().nullable(), hospitals: z.array(Hospital), cached: z.boolean() });

// ---------- POST /api/emergency/sos ----------
export const EmergencySosReq = z.object({ lat: Lat, lng: Lng, note: z.string().max(500).optional() });
export const EmergencySosRes = z.object({
  request_id: z.guid(),
  status: z.enum(["requested","dispatched","arriving","completed","cancelled"]),
  eta_minutes: z.number().int(),
  hospitals: z.array(Hospital),
  contacts: z.array(z.object({ name: z.string(), phone: z.string() })),
  sms_body: z.string(),                  // includes https://maps.google.com/?q=<lat>,<lng>
});

// A registration year runs from 1950 to the current calendar year in India. The year is read when the request is
// validated (not when this module loads), in Asia/Kolkata so the limit does not flip at 05:30 IST on 1 January.
export const currentRegistrationYear = (): number =>
  Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" }).format(new Date()));
const registrationYear = z.number().int().min(1950).refine((y) => y <= currentRegistrationYear(), {
  message: "Year of registration cannot be in the future",
});

// ---------- POST /api/doctors/verify ----------  (role: doctor, verifies self)
export const DoctorVerifyReq = z.object({
  reg_no: z.string().min(1), state_council: z.string().min(2),
  year_of_registration: registrationYear.optional(),
});
export const DoctorVerifyRes = z.object({
  status: z.enum(["verified","failed","pending"]),
  match: z.object({
    name: z.string(), reg_no: z.string(), state_council: z.string(),
    year_of_registration: z.number().int().nullable(),
  }).nullable(),
  checked_at: z.string(),
});
// An admin records the outcome of checking a doctor's registration in the public register by hand.
export const AdminDoctorCheckReq = z.object({
  doctor_id: z.guid(), decision: z.enum(["approve","reject"]),
  reg_no: z.string().min(1).max(40), state_council: z.string().min(2).max(80),
  year: registrationYear.nullable(), note: z.string().max(300),
});

// ---------- POST /api/prescriptions/extract ----------
// client first uploads the file to bucket "prescriptions" at {user_id}/{uuid}.{ext}
export const PrescriptionExtractReq = z.object({ file_path: z.string() });
export const PrescriptionExtractRes = z.object({
  prescription_id: z.guid(),
  doctor_name: z.string().nullable(),
  diagnosis: z.string().nullable(),
  issued_on: isoDate,
  items: z.array(PrescriptionItem),      // already saved in DB; times filled from DEFAULT_TIMES if missing
  warnings: z.array(z.string()),         // e.g. "Could not read dose for item 2", allergy clashes
  ai: AiMeta,
});

// ---------- POST /api/reports/analyze ----------
// client first uploads the file to bucket "lab-reports" at {user_id}/{uuid}.{ext}
export const ReportAnalyzeReq = z.object({ file_path: z.string(), report_date: isoDate.optional() });
export const ReportAnalyzeRes = z.object({
  report_id: z.guid(),
  lab_name: z.string().nullable(),
  report_date: isoDate.nullable(),
  summary: z.string(),                   // plain language, 3–6 sentences, no diagnosis
  values: z.array(LabValue),
  follow_up_tests: z.array(z.string()),
  ai: AiMeta,
});

// ---------- POST /api/reports/values/correct ---------- (P23, ADR-062)
export const LabValueCorrectReq = z
  .object({
    value_id: z.guid(),
    value: z.number().finite().nullable(),
    value_text: z.string().trim().min(1).max(60).nullable().optional(), // a written result, e.g. "Negative"
    unit: z.string().trim().min(1).max(20).nullable().optional(),       // omitted = keep the stored unit
  })
  .refine((b) => b.value !== null || !!b.value_text, { message: "Send a value or a value_text", path: ["value"] });
export const LabValueCorrectRes = z.object({
  report_id: z.guid(),
  value: LabValue,
  summary: z.string(),
  follow_up_tests: z.array(z.string()),
});

// ---------- POST /api/care-plan ----------  (replaces the v1 nutrition plan)
export const CarePlan = z.object({
  condition: z.string(),
  summary: z.string(),
  do: z.array(z.string()),
  dont: z.array(z.string()),
  diet: z.object({
    eat_more: z.array(z.string()),
    limit: z.array(z.string()),
    sample_day: z.array(z.object({ meal: z.enum(["breakfast","lunch","dinner","snack"]), items: z.array(z.string()) })),
  }),
  red_flags: z.array(z.string()),                     // symptoms → go to hospital / call 108
  follow_up_tests: z.array(z.object({ test: z.string(), every_days: z.number().int().positive() })),
  sources: z.array(SourceLink),
  language: Language,
});
export const CarePlanStatus = z.enum(["draft","approved","patient_generated"]);
export const GenerateCarePlanReq = z.object({ condition_id: z.guid(), language: Language.optional() });
export const GenerateCarePlanRes = z.object({ care_plan_id: z.guid(), status: CarePlanStatus, plan: CarePlan, ai: AiMeta });

// ---------- POST /api/medicines/interactions ----------
// empty = all active medicines. CONTRACT CHANGED 13 Oct (ADR-061): a doctor sends prescription_id or patient_id.
export const InteractionsReq = z.object({ prescription_id: z.guid().optional(), patient_id: z.guid().optional() });
export const Interaction = z.object({
  medicine_a: z.string(),
  medicine_b: z.string(),
  severity: z.enum(["major","moderate","minor"]),
  effect: z.string(),
  advice: z.string(),
  quote: z.string(),                                  // the sentence from the source that states this interaction
  sources: z.array(SourceLink),
  layer: z.enum(["table","sources"]).optional(),     // CONTRACT CHANGED 13 Oct (ADR-046): which layer found it
});
export const InteractionsRes = z.object({
  checked_medicines: z.array(z.string()),
  interactions: z.array(Interaction),
  sources_checked: z.array(SourceLink),               // shown as "no interaction found in: …" when interactions is empty
  not_checked: z.array(z.string()).optional(),       // CONTRACT CHANGED 13 Oct (ADR-046): medicines whose salt is unknown, so not checked
  cached: z.boolean(),
  ai: AiMeta,
});

// ---------- POST /api/triage ----------  (never names a disease)
export const TriageReq = z.object({
  symptoms: z.string().min(3).max(1000),
  age: z.number().int().min(0).max(120).optional(),
  sex: z.enum(["male","female","other"]).optional(),
  duration: z.string().max(100).optional(),
  language: Language.optional(),
});
export const TriageRes = z.object({
  urgency: z.enum(["emergency","soon","routine"]),
  departments: z.array(z.string()),                   // only names from the seeded departments list
  advice: z.string(),
  red_flags: z.array(z.string()),
  disclaimer: z.string(),
  ai: AiMeta,
});

// ---------- GET /api/share/[token] ----------  (no auth; token in the path)
export const SharedProfile = z.object({
  full_name: z.string().nullable(),
  age: z.number().int().nullable(),
  blood_group: z.string().nullable(),
  allergies: z.array(z.string()),
  conditions: z.array(z.string()),
  active_medicines: z.array(z.object({
    name: z.string(),
    strength: z.string().nullable(),
    dose: z.string().nullable(),
    frequency: z.string(),
  })),
  emergency_contacts: z.array(z.object({ name: z.string(), phone: z.string() })),
});
// Health Memory Graph (v1.1.0): what the patient chose to put in the link. Only the sections whose scope is on are
// present; every number is a stored row (flags are the stored, code-computed ones), there is no AI text.
export const ShareScope = z.enum(["labs","vitals","medicines","adherence"]);
export const ShareMemory = z.object({
  labs: z.array(z.object({                            // max 24 tests, 24 points each, last 24 months
    test_name: z.string(), unit: z.string().nullable(),
    ref_low: z.number().nullable(), ref_high: z.number().nullable(),
    points: z.array(z.object({ date: isoDate, value: z.number(), flag: z.enum(["low","normal","high","unknown"]) })),
  })).optional(),
  vitals: z.array(z.object({                          // last 12 months; value2 = the second number (diastolic)
    type: z.string(), unit: z.string().nullable(),
    points: z.array(z.object({ at: z.string(), value: z.number(), value2: z.number().nullable() })),
  })).optional(),
  medicines: z.array(z.object({
    name: z.string(), strength: z.string().nullable(), dose: z.string().nullable(), frequency: z.string(),
    start: isoDate, end: isoDate.nullable(),
  })).optional(),
  adherence: z.object({                               // last 30 days, India dates
    days: z.array(z.object({ date: isoDate, taken: z.number().int(), missed: z.number().int(), skipped: z.number().int() })),
    percent_taken: z.number().min(0).max(100).nullable(),
  }).optional(),
});
export const ShareRes = z.object({
  kind: z.enum(["medical_id","timeline"]),
  profile: SharedProfile,
  timeline: z.array(z.object({
    date: isoDate,
    kind: z.enum(["prescription","report","appointment","condition"]),
    title: z.string(),
    summary: z.string().nullable(),
  })).nullable(),                                     // only for kind = "timeline"
  memory: ShareMemory.nullable(),                     // CONTRACT CHANGED 21 Oct (v1.1.0): null for a link without scopes (the old flat page)
  expires_at: z.string(),
});

// ---------- POST /api/assistant/chat ----------  (the reply is an AI SDK UI-message stream, not JSON)
// The client sends AI SDK UI messages. Only the text of the last 20 user/assistant messages is read, the last
// message must be the user's question, and a message's text is capped here like every other body's field
// (this body lived in the server lib, with the cap as a hand check after parsing, until issue #375).
export const ChatBody = z.object({
  session_id: z.guid().optional(),
  messages: z
    .array(
      z
        .object({
          role: z.enum(["system", "user", "assistant"]),
          parts: z.array(z.object({ type: z.string(), text: z.string().max(4_000).optional() }).loose()),
        })
        .loose(),
    )
    .min(1)
    .max(100),
});

// ---------- GET /api/me/export · DELETE /api/me ----------
export const MeExportRes = z.record(z.string(), z.unknown()); // every row the user owns, keyed by table
export const OkRes = z.object({ ok: z.literal(true) });

// Connected devices (#327, ADR-073; provisional until Vaibhav's W1/W2 land): the phone's
// own health store is the source — aggregates only, one row a day plus spot readings.
export const DeviceMetric = z.enum([
  "steps",
  "heart_rate",
  "sleep",
  "blood_oxygen",
  "blood_pressure",
  "blood_glucose",
  "weight",
]);
export const DevicePlatform = z.enum(["health_connect", "apple_health"]);
export const DeviceConnectionStatus = z.enum(["connected", "paused", "not_connected"]);
export const DeviceConnection = z.object({
  platform: DevicePlatform,
  /** False when the store is not on this phone (Health Connect missing on Android 13 and below). */
  available: z.boolean(),
  status: DeviceConnectionStatus,
  last_synced_at: z.string().nullable(),
  /** The last sync did not finish; the screens say so in a plain sentence, never a code. */
  last_sync_failed: z.boolean(),
  metrics: z.array(DeviceMetric),
});
export const DeviceConnectionsRes = z.object({
  consent_granted: z.boolean(),
  connections: z.array(DeviceConnection),
});


// ---------- inferred types ----------
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
export type Hospital = z.infer<typeof Hospital>;
export type PrescriptionItem = z.infer<typeof PrescriptionItem>;
export type LabValue = z.infer<typeof LabValue>;
export type SourceLink = z.infer<typeof SourceLink>;
export type BloodGroup = z.infer<typeof BloodGroup>;
export type BloodComponent = z.infer<typeof BloodComponent>;
export type BloodSearchReq = z.infer<typeof BloodSearchReq>;
export type BloodBank = z.infer<typeof BloodBank>;
export type BloodSearchSource = z.infer<typeof BloodSearchSource>;
export type BloodSearchRes = z.infer<typeof BloodSearchRes>;
export type BloodRequestStatus = z.infer<typeof BloodRequestStatus>;
export type BloodRequest = z.infer<typeof BloodRequest>;
export type EmergencyNearbyReq = z.infer<typeof EmergencyNearbyReq>;
export type EmergencyNearbyRes = z.infer<typeof EmergencyNearbyRes>;
export type EmergencySosReq = z.infer<typeof EmergencySosReq>;
export type EmergencySosRes = z.infer<typeof EmergencySosRes>;
export type DoctorVerifyReq = z.infer<typeof DoctorVerifyReq>;
export type DoctorVerifyRes = z.infer<typeof DoctorVerifyRes>;
export type AdminDoctorCheckReq = z.infer<typeof AdminDoctorCheckReq>;
export type PrescriptionExtractReq = z.infer<typeof PrescriptionExtractReq>;
export type PrescriptionExtractRes = z.infer<typeof PrescriptionExtractRes>;
export type ReportAnalyzeReq = z.infer<typeof ReportAnalyzeReq>;
export type ReportAnalyzeRes = z.infer<typeof ReportAnalyzeRes>;
export type LabValueCorrectReq = z.infer<typeof LabValueCorrectReq>;
export type LabValueCorrectRes = z.infer<typeof LabValueCorrectRes>;
export type Language = z.infer<typeof Language>;
export type AiMeta = z.infer<typeof AiMeta>;
export type CarePlan = z.infer<typeof CarePlan>;
export type CarePlanStatus = z.infer<typeof CarePlanStatus>;
export type GenerateCarePlanReq = z.infer<typeof GenerateCarePlanReq>;
export type GenerateCarePlanRes = z.infer<typeof GenerateCarePlanRes>;
export type InteractionsReq = z.infer<typeof InteractionsReq>;
export type Interaction = z.infer<typeof Interaction>;
export type InteractionsRes = z.infer<typeof InteractionsRes>;
export type TriageReq = z.infer<typeof TriageReq>;
export type TriageRes = z.infer<typeof TriageRes>;
export type SharedProfile = z.infer<typeof SharedProfile>;
export type ShareScope = z.infer<typeof ShareScope>;
export type ShareMemory = z.infer<typeof ShareMemory>;
export type ShareRes = z.infer<typeof ShareRes>;
export type ChatBody = z.infer<typeof ChatBody>;
export type MeExportRes = z.infer<typeof MeExportRes>;
export type OkRes = z.infer<typeof OkRes>;
export type DeviceMetric = z.infer<typeof DeviceMetric>;
export type DevicePlatform = z.infer<typeof DevicePlatform>;
export type DeviceConnectionStatus = z.infer<typeof DeviceConnectionStatus>;
export type DeviceConnection = z.infer<typeof DeviceConnection>;
export type DeviceConnectionsRes = z.infer<typeof DeviceConnectionsRes>;
