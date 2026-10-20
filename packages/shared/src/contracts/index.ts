// API contracts shared by the server routes and both clients.
// Field names are final: JSON over HTTP is snake_case, the same as the DB columns.
import { z } from "zod";

export const ErrorCode = z.enum(["UNAUTHORIZED","FORBIDDEN","BAD_REQUEST","NOT_FOUND","UPSTREAM_TIMEOUT","UPSTREAM_ERROR","INTERNAL","RATE_LIMITED"]);
export const ApiErrorBody = z.object({ error: z.object({ code: ErrorCode, message: z.string() }) });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);       // YYYY-MM-DD
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);                  // HH:MM 24h

// ---------- AI accuracy & safety (plan §2A) ----------
export const Language = z.enum(["en","hi","hinglish"]);
// run_id: the ai_runs row, so "Report a mistake" can name it (CONTRACT CHANGED 14 Oct, ADR-063). null when it wasn't saved.
export const AiMeta = z.object({ model: z.string(), prompt_version: z.string(), generated_at: z.string(), run_id: z.guid().nullable().optional() });
// Extracted fields: `evidence` is the exact source text; `needs_review` is set when it can't be verified.
const aiReviewFields = { needs_review: z.boolean().optional(), evidence: z.string().nullable().optional() };

// ---------- shared pieces ----------
export const PriceSource = z.enum(["1mg","pharmeasy","netmeds","apollo","janaushadhi","healthians","redcliffe","thyrocare","1mg_labs"]);
export const PriceQuote = z.object({
  kind: z.enum(["medicine","lab_test"]),
  query: z.string(),
  source: PriceSource,
  product_name: z.string(),
  pack_size: z.string().nullable(),
  price: z.number().nullable(),          // INR selling price
  mrp: z.number().nullable(),            // INR
  in_stock: z.boolean().nullable(),
  product_url: z.string().nullable(),
  fetched_at: z.string(),                // ISO datetime
  price_verified: z.boolean().optional(), // CONTRACT CHANGED 13 Oct (ADR-050): price seen on the fetched page
});
export const SourceStatus = z.object({ source: PriceSource, status: z.enum(["pending","ok","not_found","timeout","error"]) }); // "pending" added 13 Oct (ADR-050)

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

// ---------- single-medicine price check ----------
// No route of its own (ADR-038): medicines.compare posts a one-item basket and returns BasketCompareRes.
export const MedicinesCompareReq = z.object({ medicine: z.string().min(2), strength: z.string().optional() });

// ---------- POST /api/labs/compare ----------
export const LabsCompareReq = z.object({ test_name: z.string().min(2), city: z.string().min(2) });
export const LabsCompareRes = z.object({            // CONTRACT CHANGED 13 Oct (ADR-050): a job like the basket
  job_id: z.string().min(1),                          // poll GET /api/labs/compare/{job_id} while running
  status: z.enum(["running","done"]),
  query: z.string(), city: z.string(),
  quotes: z.array(PriceQuote),                        // verified first, by price
  sources: z.array(SourceStatus),
  cheapest: PriceQuote.nullable(),                    // lowest VERIFIED price
  cached: z.boolean(),
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

// ---------- POST /api/doctors/verify ----------  (role: doctor, verifies self)
export const DoctorVerifyReq = z.object({
  reg_no: z.string().min(1), state_council: z.string().min(2),
  year_of_registration: z.number().int().optional(),
});
export const DoctorVerifyRes = z.object({
  status: z.enum(["verified","failed","pending"]),
  match: z.object({
    name: z.string(), reg_no: z.string(), state_council: z.string(),
    year_of_registration: z.number().int().nullable(),
  }).nullable(),
  checked_at: z.string(),
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

// ---------- POST /api/prescriptions/basket ----------
export const BasketItemInput = z.object({
  medicine: z.string().min(2),
  strength: z.string().optional(),
  quantity: z.number().int().positive().optional(),   // packs to buy; default 1
});
export const BasketCompareReq = z.object({
  prescription_id: z.guid().optional(),      // price the prescription's active items
  items: z.array(BasketItemInput).min(1).max(10).optional(), // or an ad-hoc list (e.g. "Reorder" for one item)
}).refine((b) => Boolean(b.prescription_id) !== Boolean(b.items), { message: "Send prescription_id or items, not both" });
export const BasketLine = z.object({
  medicine: z.string(),
  strength: z.string().nullable(),
  quantity: z.number().int(),
  product_name: z.string().nullable(),
  pack_size: z.string().nullable(),
  unit_price: z.number().nullable(),                  // INR per pack
  line_total: z.number().nullable(),                  // unit_price × quantity; null unless price_verified
  in_stock: z.boolean().nullable(),
  product_url: z.string().nullable(),
  price_verified: z.boolean(),                        // the price was found on the fetched product page (plan §2A)
});
export const PharmacyBasket = z.object({
  source: PriceSource,
  status: z.enum(["pending","ok","partial","not_found","timeout","error"]), // pending = agent still running; partial = some items missing or unverified
  lines: z.array(BasketLine),
  total: z.number().nullable(),                       // sum of verified lines
  missing: z.array(z.string()),                       // medicines not found on this pharmacy
  checkout_url: z.string().nullable(),                // page the user opens to order and pay
});
export const BasketCompareRes = z.object({
  job_id: z.string().min(1),                          // opaque; poll GET /api/prescriptions/basket/{job_id} while running
  status: z.enum(["running","done"]),               // done = no basket is pending
  baskets: z.array(PharmacyBasket),                   // complete baskets first, then by total asc; nulls last
  cheapest_source: PriceSource.nullable(),            // cheapest COMPLETE basket
  generic: z.object({ lines: z.array(BasketLine), total: z.number().nullable() }).nullable(), // Jan Aushadhi
  savings_vs_highest: z.number().nullable(),          // INR: most expensive complete basket − cheapest
  cached: z.boolean(),
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

// ---------- POST /api/hospitals/info ----------
export const HospitalInfoReq = z.object({ hospital_id: z.guid() });
export const HospitalInfoRes = z.object({
  hospital_id: z.guid(),
  opd: z.array(z.object({ department: z.string(), days: z.string(), timings: z.string() })),
  notes: z.string().nullable(),
  source_url: z.string().nullable(),
  fetched_at: z.string(),
  cached: z.boolean(),
});

// ---------- POST /api/schemes/pmjay-hospitals ----------
export const PmjayHospitalsReq = z.object({ lat: z.number(), lng: z.number() });
export const PmjayHospitalsRes = z.object({
  area: z.string().nullable(),
  hospitals: z.array(z.object({
    name: z.string(),
    address: z.string().nullable(),
    specialities: z.array(z.string()),
    source_url: z.string().nullable(),
  })),
  cached: z.boolean(),
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
export const ShareRes = z.object({
  kind: z.enum(["medical_id","timeline"]),
  profile: SharedProfile,
  timeline: z.array(z.object({
    date: isoDate,
    kind: z.enum(["prescription","report","appointment","condition"]),
    title: z.string(),
    summary: z.string().nullable(),
  })).nullable(),                                     // only for kind = "timeline"
  expires_at: z.string(),
});

// ---------- GET /api/me/export · DELETE /api/me ----------
export const MeExportRes = z.record(z.string(), z.unknown()); // every row the user owns, keyed by table
export const OkRes = z.object({ ok: z.literal(true) });


// ---------- inferred types ----------
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
export type PriceSource = z.infer<typeof PriceSource>;
export type PriceQuote = z.infer<typeof PriceQuote>;
export type SourceStatus = z.infer<typeof SourceStatus>;
export type Hospital = z.infer<typeof Hospital>;
export type PrescriptionItem = z.infer<typeof PrescriptionItem>;
export type LabValue = z.infer<typeof LabValue>;
export type SourceLink = z.infer<typeof SourceLink>;
export type MedicinesCompareReq = z.infer<typeof MedicinesCompareReq>;
export type LabsCompareReq = z.infer<typeof LabsCompareReq>;
export type LabsCompareRes = z.infer<typeof LabsCompareRes>;
export type EmergencyNearbyReq = z.infer<typeof EmergencyNearbyReq>;
export type EmergencyNearbyRes = z.infer<typeof EmergencyNearbyRes>;
export type EmergencySosReq = z.infer<typeof EmergencySosReq>;
export type EmergencySosRes = z.infer<typeof EmergencySosRes>;
export type DoctorVerifyReq = z.infer<typeof DoctorVerifyReq>;
export type DoctorVerifyRes = z.infer<typeof DoctorVerifyRes>;
export type PrescriptionExtractReq = z.infer<typeof PrescriptionExtractReq>;
export type PrescriptionExtractRes = z.infer<typeof PrescriptionExtractRes>;
export type ReportAnalyzeReq = z.infer<typeof ReportAnalyzeReq>;
export type ReportAnalyzeRes = z.infer<typeof ReportAnalyzeRes>;
export type LabValueCorrectReq = z.infer<typeof LabValueCorrectReq>;
export type LabValueCorrectRes = z.infer<typeof LabValueCorrectRes>;
export type Language = z.infer<typeof Language>;
export type AiMeta = z.infer<typeof AiMeta>;
export type BasketItemInput = z.infer<typeof BasketItemInput>;
export type BasketCompareReq = z.infer<typeof BasketCompareReq>;
export type BasketLine = z.infer<typeof BasketLine>;
export type PharmacyBasket = z.infer<typeof PharmacyBasket>;
export type BasketCompareRes = z.infer<typeof BasketCompareRes>;
export type CarePlan = z.infer<typeof CarePlan>;
export type CarePlanStatus = z.infer<typeof CarePlanStatus>;
export type GenerateCarePlanReq = z.infer<typeof GenerateCarePlanReq>;
export type GenerateCarePlanRes = z.infer<typeof GenerateCarePlanRes>;
export type InteractionsReq = z.infer<typeof InteractionsReq>;
export type Interaction = z.infer<typeof Interaction>;
export type InteractionsRes = z.infer<typeof InteractionsRes>;
export type TriageReq = z.infer<typeof TriageReq>;
export type TriageRes = z.infer<typeof TriageRes>;
export type HospitalInfoReq = z.infer<typeof HospitalInfoReq>;
export type HospitalInfoRes = z.infer<typeof HospitalInfoRes>;
export type PmjayHospitalsReq = z.infer<typeof PmjayHospitalsReq>;
export type PmjayHospitalsRes = z.infer<typeof PmjayHospitalsRes>;
export type SharedProfile = z.infer<typeof SharedProfile>;
export type ShareRes = z.infer<typeof ShareRes>;
export type MeExportRes = z.infer<typeof MeExportRes>;
export type OkRes = z.infer<typeof OkRes>;
