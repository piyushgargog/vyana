// API contracts shared by the server routes and both clients.
// Field names are final: JSON over HTTP is snake_case, the same as the DB columns.
import { z } from "zod";

export const ErrorCode = z.enum(["UNAUTHORIZED","FORBIDDEN","BAD_REQUEST","NOT_FOUND","UPSTREAM_TIMEOUT","UPSTREAM_ERROR","INTERNAL"]);
export const ApiErrorBody = z.object({ error: z.object({ code: ErrorCode, message: z.string() }) });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);       // YYYY-MM-DD
const hhmm = z.string().regex(/^\d{2}:\d{2}$/);                  // HH:MM 24h

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
});
export const SourceStatus = z.object({ source: PriceSource, status: z.enum(["ok","not_found","timeout","error"]) });

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
  id: z.string().uuid(),
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
});

export const LabValue = z.object({
  test_name: z.string(),
  value: z.number().nullable(),
  value_text: z.string().nullable(),
  unit: z.string().nullable(),
  ref_low: z.number().nullable(),
  ref_high: z.number().nullable(),
  flag: z.enum(["low","normal","high","unknown"]),
});

export const DrugAlert = z.object({
  id: z.string().uuid(), medicine_name: z.string(), title: z.string(),
  url: z.string(), snippet: z.string().nullable(), created_at: z.string(),
});

export const SourceLink = z.object({ title: z.string(), url: z.string() });

// ---------- POST /api/medicines/compare ----------
export const MedicinesCompareReq = z.object({ medicine: z.string().min(2), strength: z.string().optional() });
export const MedicinesCompareRes = z.object({
  query: z.string(),                     // normalized, e.g. "dolo 650"
  quotes: z.array(PriceQuote),           // sorted by price asc, nulls last
  sources: z.array(SourceStatus),        // one per pharmacy tried
  cheapest: PriceQuote.nullable(),
  generic: PriceQuote.nullable(),        // Jan Aushadhi alternative (best effort)
  generic_salt: z.string().nullable(),   // e.g. "Paracetamol 650 mg"
  cached: z.boolean(),
});

// ---------- POST /api/labs/compare ----------
export const LabsCompareReq = z.object({ test_name: z.string().min(2), city: z.string().min(2) });
export const LabsCompareRes = z.object({
  query: z.string(), quotes: z.array(PriceQuote), sources: z.array(SourceStatus),
  cheapest: PriceQuote.nullable(), cached: z.boolean(),
});

// ---------- POST /api/emergency/nearby ----------
export const EmergencyNearbyReq = z.object({ lat: z.number(), lng: z.number() });
export const EmergencyNearbyRes = z.object({ area: z.string().nullable(), hospitals: z.array(Hospital), cached: z.boolean() });

// ---------- POST /api/emergency/sos ----------
export const EmergencySosReq = z.object({ lat: z.number(), lng: z.number(), note: z.string().optional() });
export const EmergencySosRes = z.object({
  request_id: z.string().uuid(),
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
  prescription_id: z.string().uuid(),
  doctor_name: z.string().nullable(),
  diagnosis: z.string().nullable(),
  issued_on: isoDate,
  items: z.array(PrescriptionItem),      // already saved in DB; times filled from DEFAULT_TIMES if missing
  warnings: z.array(z.string()),         // e.g. "Could not read dose for item 2", allergy clashes
});

// ---------- POST /api/reports/analyze ----------
// client first uploads the file to bucket "lab-reports" at {user_id}/{uuid}.{ext}
export const ReportAnalyzeReq = z.object({ file_path: z.string(), report_date: isoDate.optional() });
export const ReportAnalyzeRes = z.object({
  report_id: z.string().uuid(),
  lab_name: z.string().nullable(),
  report_date: isoDate.nullable(),
  summary: z.string(),                   // plain language, 3–6 sentences, no diagnosis
  values: z.array(LabValue),
  follow_up_tests: z.array(z.string()),
});

// ---------- POST /api/nutrition/plan ----------
export const NutritionPlanReq = z.object({ condition_ids: z.array(z.string().uuid()).optional() });
export const NutritionPlanRes = z.object({
  plan_id: z.string().uuid(),
  conditions: z.array(z.string()),
  summary: z.string(),
  eat_more: z.array(z.string()),
  limit: z.array(z.string()),
  sample_day: z.array(z.object({ meal: z.enum(["breakfast","lunch","dinner","snack"]), items: z.array(z.string()) })),
  sources: z.array(SourceLink),
});

// ---------- POST /api/alerts/check ----------  (checks the caller's active medicines now)
export const AlertsCheckReq = z.object({});
export const AlertsCheckRes = z.object({ checked_medicines: z.array(z.string()), alerts: z.array(DrugAlert) });

// ---------- inferred types ----------
export type ErrorCode = z.infer<typeof ErrorCode>;
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;
export type PriceSource = z.infer<typeof PriceSource>;
export type PriceQuote = z.infer<typeof PriceQuote>;
export type SourceStatus = z.infer<typeof SourceStatus>;
export type Hospital = z.infer<typeof Hospital>;
export type PrescriptionItem = z.infer<typeof PrescriptionItem>;
export type LabValue = z.infer<typeof LabValue>;
export type DrugAlert = z.infer<typeof DrugAlert>;
export type SourceLink = z.infer<typeof SourceLink>;
export type MedicinesCompareReq = z.infer<typeof MedicinesCompareReq>;
export type MedicinesCompareRes = z.infer<typeof MedicinesCompareRes>;
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
export type NutritionPlanReq = z.infer<typeof NutritionPlanReq>;
export type NutritionPlanRes = z.infer<typeof NutritionPlanRes>;
export type AlertsCheckReq = z.infer<typeof AlertsCheckReq>;
export type AlertsCheckRes = z.infer<typeof AlertsCheckRes>;
