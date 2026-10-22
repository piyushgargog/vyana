// Generates apps/web/openapi.yaml from the Zod contracts, so the public API reference never drifts from the code.
// Run: pnpm docs:openapi   (CI fails if the committed file is out of date)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";
import { toJSONSchema, type ZodType } from "zod";

import * as c from "../packages/shared/src/contracts/index.ts";
import { RATE_LIMITED_ROUTES, RATE_LIMITS } from "../packages/shared/src/constants.ts";

type Route = {
  path: string;
  method?: "get" | "post" | "delete";
  summary: string;
  description: string;
  tag: string;
  req: ZodType | null;
  res: ZodType;
  roles: string;
  tinyfish?: string;
  /** No bearer token (e.g. share links, which carry their own token in the path). */
  publicRoute?: boolean;
  pathParams?: { name: string; description: string }[];
};

const routes: Route[] = [
  { path: "/api/labs/compare", tag: "Prices", summary: "Start a lab test price compare in a city", description: "Search finds each lab's own page for the test (Healthians, Redcliffe, Thyrocare, 1mg Labs) and one web agent per lab starts reading it in the background. Returns a `job_id` at once (`status: running`, every lab `pending`), or the finished result from the 24 h cache (`cached: true`). Poll GET /api/labs/compare/{job_id}.", req: c.LabsCompareReq, res: c.LabsCompareRes, roles: "any signed-in user", tinyfish: "Search, Agent ×4 (async)" },
  { path: "/api/labs/compare/{job_id}", method: "get", pathParams: [{ name: "job_id", description: "Opaque job id returned by POST /api/labs/compare" }], tag: "Prices", summary: "Check a lab test price compare", description: "Reports every lab. A finished lab's test page must be on the lab's own site, and a price counts (`price_verified`) only when it appears on that page. Verified prices come first, by price; `cheapest` is the lowest verified one. Only the user who started the job can read it.", req: null, res: c.LabsCompareRes, roles: "the user who started the job", tinyfish: "Fetch (price check)" },
  { path: "/api/blood/search", tag: "Emergency", summary: "Start a blood bank search in a city", description: "RapidBlood: reads the stock the public e-RaktKosh service lists for the searched city and up to three nearby cities (about a second; answers cached for 15 minutes). Returns the banks at once (`status: done`) with a `job_id` that repeats the search from the cache. A row is what the source showed at `fetched_at`; call the blood bank to confirm.", req: c.BloodSearchReq, res: c.BloodSearchRes, roles: "any signed-in user", tinyfish: "none (direct read of a public service)" },
  { path: "/api/blood/search/{job_id}", method: "get", pathParams: [{ name: "job_id", description: "Opaque job id returned by POST /api/blood/search" }], tag: "Emergency", summary: "Check a blood bank search", description: "Repeats the search of the job from the cache and reports every area. Every row was read from the source response itself (`verified`). Only the user who started the job can read it.", req: null, res: c.BloodSearchRes, roles: "the user who started the job", tinyfish: "none (direct read of a public service)" },
  { path: "/api/prescriptions/extract", tag: "Health records", summary: "Read an uploaded prescription", description: "Upload the file to the `prescriptions` bucket at `{user_id}/{uuid}.{ext}` first. The server reads it with a vision model, saves the prescription and its items, and returns them with reminder times filled in.", req: c.PrescriptionExtractReq, res: c.PrescriptionExtractRes, roles: "patient" },
  { path: "/api/reports/analyze", tag: "Health records", summary: "Analyze an uploaded lab report", description: "Upload the file to the `lab-reports` bucket first. Returns the values with reference ranges and high/low flags, and a plain-language summary (never a diagnosis).", req: c.ReportAnalyzeReq, res: c.ReportAnalyzeRes, roles: "patient" },
  { path: "/api/reports/values/correct", tag: "Health records", summary: "Correct one value of a lab report", description: "The patient corrects a value the AI read from their own report (by the value's `id` from the analysis). The flag is recomputed on the server from the report's reference range, the report summary is rebuilt in code, and the old value is kept for the record. Another person's value answers 404.", req: c.LabValueCorrectReq, res: c.LabValueCorrectRes, roles: "patient" },
  { path: "/api/emergency/nearby", tag: "Emergency", summary: "Find nearby emergency hospitals", description: "Reverse-geocodes the location and finds hospitals with emergency/ICU care from the live web. Cached for 6 h per ~1 km area. Never fails: returns an empty list if nothing is found.", req: c.EmergencyNearbyReq, res: c.EmergencyNearbyRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/emergency/sos", tag: "Emergency", summary: "Raise an SOS", description: "Creates an emergency request, returns nearby hospitals, the user's emergency contacts and a ready-to-send SMS with a maps link. The request status updates live via Supabase Realtime.", req: c.EmergencySosReq, res: c.EmergencySosRes, roles: "patient" },
  { path: "/api/doctors/verify", tag: "Doctors", summary: "Verify a doctor against the NMC Indian Medical Register", description: "A web agent reads the official register; code decides. `verified` only when the registration number, council, surname and name (initials allowed) all match, and the year too when both give one. `failed` shows the closest register row (or none). `pending` when the register can't be read; a CAPTCHA is never automated. A number already verified on another account fails. Register answers are cached for 30 days.", req: c.DoctorVerifyReq, res: c.DoctorVerifyRes, roles: "doctor (verifies self)", tinyfish: "Agent" },
  { path: "/api/prescriptions/basket", tag: "Prices", summary: "Start pricing a whole prescription across pharmacies", description: "Starts one web agent per pharmacy (1mg, PharmEasy, Netmeds, Apollo) for every medicine in the basket (a single-medicine check is a one-item basket) and returns at once with a `job_id` and `status: running` (pharmacies still working are `pending`). Poll `GET /api/prescriptions/basket/{job_id}` until `status: done`. A basket priced in the last 24 h comes back `done` and `cached: true`. Send `prescription_id` or `items`, not both.", req: c.BasketCompareReq, res: c.BasketCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4 (async)" },
  { path: "/api/prescriptions/basket/{job_id}", method: "get", pathParams: [{ name: "job_id", description: "Opaque job id returned by POST /api/prescriptions/basket" }], tag: "Prices", summary: "Check a basket pricing job", description: "Reports every pharmacy's basket. Finished pharmacies are checked by the server: product links must be on the pharmacy's own site, and a price counts (`price_verified`) only when it appears on the product page. Unverified prices are shown but not added to totals. Totals, ordering, the cheapest complete basket and savings are computed by the server. Only the user who started the job can read it; others get 404.", req: null, res: c.BasketCompareRes, roles: "the user who started the job", tinyfish: "Agent runs (status), Fetch" },
  { path: "/api/hospitals/info", tag: "Appointments", summary: "Get a hospital's OPD timings", description: "Department-wise OPD days and timings taken from the hospital's own pages, with the source link. Cached for 7 days.", req: c.HospitalInfoReq, res: c.HospitalInfoRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/care-plan", tag: "Care", summary: "Generate a care plan for a condition", description: "Built only from trusted guideline pages: every bullet must quote the page it comes from, follow-up intervals are read from those quotes, and the plan never mentions medicines or doses. Red flags include a reviewed list for common conditions. A doctor's request creates a `draft` the doctor must approve; a patient can generate a plan only for a condition they added, marked as not reviewed by a doctor (403 for a doctor's diagnosis).", req: c.GenerateCarePlanReq, res: c.GenerateCarePlanRes, roles: "patient, or the patient's doctor", tinyfish: "Search, Fetch" },
  { path: "/api/medicines/interactions", tag: "Care", summary: "Check a patient's medicines for interactions", description: "A patient checks their own medicines (all current ones, or one prescription). A doctor checks a patient they treat by sending `prescription_id` or `patient_id`; any other doctor gets 403. Brand names are mapped to salts from a reviewed list (or a salt written in brackets); medicines that can't be mapped are listed in `not_checked`. A reviewed table of well-known interactions is checked first (`layer: table`); other pairs are looked up on trusted medicine pages, and an interaction is reported only with the exact sentence that states it (`layer: sources`). When none is found, the response lists the sources that were checked; it never calls a combination safe.", req: c.InteractionsReq, res: c.InteractionsRes, roles: "patient, doctor of the patient", tinyfish: "Search, Fetch" },
  { path: "/api/triage", tag: "Care", summary: "Check symptoms and suggest a department", description: "Fixed warning-sign rules run first and return `emergency` (call 108 / SOS) without any AI. Otherwise the AI only picks the urgency and up to 2 departments from the hospital department list; the advice, warning signs and disclaimer are fixed text in the user's language. Never names a disease. If the AI can't answer, the result is `soon` + General Medicine.", req: c.TriageReq, res: c.TriageRes, roles: "any signed-in user" },
  { path: "/api/schemes/pmjay-hospitals", tag: "Emergency", summary: "Find Ayushman Bharat (PM-JAY) hospitals nearby", description: "Hospitals near the location that the live web lists as empanelled under PM-JAY, with their source links.", req: c.PmjayHospitalsReq, res: c.PmjayHospitalsRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/share/{token}", method: "get", publicRoute: true, pathParams: [{ name: "token", description: "Share token from the medical ID QR or a timeline link" }], tag: "Sharing", summary: "Read a shared medical ID or timeline", description: "Read-only record for a doctor or first responder. Works only while the link is valid and not revoked; otherwise 404.", req: null, res: c.ShareRes, roles: "anyone with a valid share link" },
  { path: "/api/me/export", method: "get", tag: "Account", summary: "Download all of my data", description: "Every record the signed-in user owns, as JSON.", req: null, res: c.MeExportRes, roles: "any signed-in user" },
  { path: "/api/me", method: "delete", tag: "Account", summary: "Delete my account", description: "Deletes the user, all their records and their uploaded files. Requires a recent login.", req: null, res: c.OkRes, roles: "any signed-in user" },
];

const components: Record<string, unknown> = {};
const ref = (name: string, schema: ZodType) => {
  const json = toJSONSchema(schema) as Record<string, unknown>;
  delete json.$schema;
  components[name] = json;
  return { $ref: `#/components/schemas/${name}` };
};
const nameOf = (schema: ZodType) => Object.entries(c).find(([, v]) => v === schema)?.[0] ?? "Unknown";

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/ApiErrorBody" } } },
});
ref("ApiErrorBody", c.ApiErrorBody);

/** The 429 of a route with a per-user limit (issue 138); the numbers come from the same table the server uses. */
const rateLimitedResponse = (route: string) => {
  const bucket = RATE_LIMITED_ROUTES[route];
  if (!bucket) return null;
  const { windowSeconds, max } = RATE_LIMITS[bucket];
  const window = windowSeconds % 3600 === 0 ? `${windowSeconds / 3600} hour${windowSeconds === 3600 ? "" : "s"}` : `${windowSeconds / 60} minutes`;
  return errorResponse(`Over the limit of ${max} calls per user in ${window}, shared with the other routes of the \`${bucket}\` group (\`RATE_LIMITED\`). Wait for the number of seconds in the \`Retry-After\` header`);
};

const paths: Record<string, unknown> = {};
for (const r of routes) {
  const method = r.method ?? "post";
  const responses: Record<string, unknown> = {
    "200": { description: "Success", content: { "application/json": { schema: ref(nameOf(r.res), r.res) } } },
  };
  if (r.req) responses["400"] = errorResponse("Invalid request body (`BAD_REQUEST`)");
  if (!r.publicRoute) {
    responses["401"] = errorResponse("Missing or invalid token (`UNAUTHORIZED`)");
    responses["403"] = errorResponse("Wrong role or not your data (`FORBIDDEN`)");
  } else {
    responses["404"] = errorResponse("Unknown, expired or revoked link (`NOT_FOUND`)");
  }
  const limited = method === "post" ? rateLimitedResponse(r.path.replace("/api/", "")) : null;
  if (limited) responses["429"] = limited;
  if (r.tinyfish) {
    responses["502"] = errorResponse("An upstream service failed (`UPSTREAM_ERROR`)");
    responses["504"] = errorResponse("An upstream service timed out (`UPSTREAM_TIMEOUT`)");
  }
  paths[r.path] = {
    ...(paths[r.path] as object | undefined),
    [method]: {
      tags: [r.tag],
      summary: r.summary,
      description: `${r.description}\n\n**Who can call it:** ${r.roles}.${r.tinyfish ? `\n\n**TinyFish:** ${r.tinyfish}.` : ""}`,
      operationId: `${method}_${r.path.replace("/api/", "").replace(/[{}]/g, "").replace(/[/-]/g, "_")}`,
      ...(r.publicRoute ? { security: [] } : {}),
      ...(r.pathParams ? { parameters: r.pathParams.map((p) => ({ name: p.name, in: "path", required: true, description: p.description, schema: { type: "string" } })) } : {}),
      ...(r.req ? { requestBody: { required: true, content: { "application/json": { schema: ref(nameOf(r.req), r.req) } } } } : {}),
      responses,
    },
  };
}

paths["/api/assistant/chat"] = {
  post: {
    tags: ["Assistant"],
    summary: "Chat with the AI health assistant (streaming)",
    description:
      "Request: `{ session_id?: string, messages: UIMessage[] }` (Vercel AI SDK UI messages; only the text of the last 20 is used, and the last one must be from the user). Response: an AI SDK UI-message stream. A new session id is returned in the `x-session-id` header. The first chunk carries `messageMetadata.ai_run_id` for \"Report a mistake\".\n\nAnswers cite pages from trusted health sites only; any other link is removed before it is sent. Emergency messages start with a fixed 108 / SOS notice.\n\n**Who can call it:** any signed-in user.\n\n**TinyFish:** Search, Fetch (as assistant tools).",
    operationId: "assistant_chat",
    responses: {
      "200": { description: "Server-sent UI message stream", headers: { "x-session-id": { schema: { type: "string", format: "uuid" } } } },
      "400": errorResponse("Invalid body, or the last message isn't from the user (`BAD_REQUEST`)"),
      "401": errorResponse("Missing or invalid token (`UNAUTHORIZED`)"),
      "404": errorResponse("`session_id` is not one of the caller's conversations (`NOT_FOUND`)"),
      "429": rateLimitedResponse("assistant/chat"),
    },
  },
};

const doc = {
  openapi: "3.1.0",
  info: {
    title: "Vyana API",
    version: "0.1.0",
    description:
      "HTTP API behind the Vyana web and mobile apps. JSON is snake_case. Every route except the TinyFish webhook needs `Authorization: Bearer <Supabase access token>`. Errors always use the `ApiErrorBody` shape.\n\nThis file is generated from `packages/shared/src/contracts` by `pnpm docs:openapi`. Do not edit it by hand.",
    license: { name: "MIT", identifier: "MIT" },
  },
  servers: [{ url: "/", description: "Same origin as the web app (local: http://localhost:3000)" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Prices", description: "Live price comparison for prescriptions, medicines and lab tests" },
    { name: "Health records", description: "Reading prescriptions and lab reports" },
    { name: "Care", description: "Care plans, interaction checks and symptom triage" },
    { name: "Appointments", description: "Hospital information for token booking" },
    { name: "Emergency", description: "SOS, nearby emergency hospitals and PM-JAY hospitals" },
    { name: "Doctors", description: "Doctor verification" },
    { name: "Sharing", description: "Read-only medical ID and timeline links" },
    { name: "Account", description: "Data export and account deletion" },
    { name: "Assistant", description: "AI health assistant chat" },
  ],
  paths,
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Supabase JWT" } },
    schemas: Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))),
  },
};

const out = fileURLToPath(new URL("../apps/web/openapi.yaml", import.meta.url));
writeFileSync(out, `# Generated by scripts/generate-openapi.mts. Do not edit by hand.\n${stringify(doc, { lineWidth: 0 })}`);
console.log(`wrote ${out} (${routes.length + 1} routes, ${Object.keys(components).length} schemas)`);
