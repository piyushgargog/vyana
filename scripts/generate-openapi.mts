// Generates apps/web/openapi.yaml from the Zod contracts, so the public API reference never drifts from the code.
// Run: pnpm docs:openapi   (CI fails if the committed file is out of date)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";
import { toJSONSchema, type ZodType } from "zod";

import * as c from "../packages/shared/src/contracts/index.ts";

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
  { path: "/api/medicines/compare", tag: "Prices", summary: "Compare a medicine's price across pharmacies", description: "Runs web agents on 1mg, PharmEasy, Netmeds and Apollo in parallel and looks up a Jan Aushadhi generic. Results are cached for 24 h. Sources that fail are reported in `sources[]`; the call still succeeds with the rest.", req: c.MedicinesCompareReq, res: c.MedicinesCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4, Search, Fetch" },
  { path: "/api/labs/compare", tag: "Prices", summary: "Compare a lab test's price across labs in a city", description: "Web agents on Healthians, Redcliffe, Thyrocare and 1mg Labs. Cached for 24 h.", req: c.LabsCompareReq, res: c.LabsCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4" },
  { path: "/api/prescriptions/extract", tag: "Health records", summary: "Read an uploaded prescription", description: "Upload the file to the `prescriptions` bucket at `{user_id}/{uuid}.{ext}` first. The server reads it with a vision model, saves the prescription and its items, and returns them with reminder times filled in.", req: c.PrescriptionExtractReq, res: c.PrescriptionExtractRes, roles: "patient" },
  { path: "/api/reports/analyze", tag: "Health records", summary: "Analyze an uploaded lab report", description: "Upload the file to the `lab-reports` bucket first. Returns the values with reference ranges and high/low flags, and a plain-language summary (never a diagnosis).", req: c.ReportAnalyzeReq, res: c.ReportAnalyzeRes, roles: "patient" },
  { path: "/api/emergency/nearby", tag: "Emergency", summary: "Find nearby emergency hospitals", description: "Reverse-geocodes the location and finds hospitals with emergency/ICU care from the live web. Cached for 6 h per ~1 km area. Never fails: returns an empty list if nothing is found.", req: c.EmergencyNearbyReq, res: c.EmergencyNearbyRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/emergency/sos", tag: "Emergency", summary: "Raise an SOS", description: "Creates an emergency request, returns nearby hospitals, the user's emergency contacts and a ready-to-send SMS with a maps link. The request status updates live via Supabase Realtime.", req: c.EmergencySosReq, res: c.EmergencySosRes, roles: "patient" },
  { path: "/api/doctors/verify", tag: "Doctors", summary: "Verify a doctor against the NMC Indian Medical Register", description: "A web agent searches the official register and compares the result with the doctor's profile. Cached for 30 days.", req: c.DoctorVerifyReq, res: c.DoctorVerifyRes, roles: "doctor (verifies self)", tinyfish: "Agent" },
  { path: "/api/alerts/check", tag: "Wellness", summary: "Check the user's medicines for quality alerts", description: "Searches recent CDSCO quality alerts and recalls for each active medicine and keeps only the genuinely relevant ones.", req: c.AlertsCheckReq, res: c.AlertsCheckRes, roles: "patient", tinyfish: "Search" },
  { path: "/api/prescriptions/basket", tag: "Prices", summary: "Start pricing a whole prescription across pharmacies", description: "Starts one web agent per pharmacy (1mg, PharmEasy, Netmeds, Apollo) for every medicine in the basket and returns at once with a `job_id` and `status: running` (pharmacies still working are `pending`). Poll `GET /api/prescriptions/basket/{job_id}` until `status: done`. A basket priced in the last 24 h comes back `done` and `cached: true`. Send `prescription_id` or `items`, not both.", req: c.BasketCompareReq, res: c.BasketCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4 (async)" },
  { path: "/api/prescriptions/basket/{job_id}", method: "get", pathParams: [{ name: "job_id", description: "Opaque job id returned by POST /api/prescriptions/basket" }], tag: "Prices", summary: "Check a basket pricing job", description: "Reports every pharmacy's basket. Finished pharmacies are checked by the server: product links must be on the pharmacy's own site, and a price counts (`price_verified`) only when it appears on the product page. Unverified prices are shown but not added to totals. Totals, ordering, the cheapest complete basket and savings are computed by the server. Only the user who started the job can read it; others get 404.", req: null, res: c.BasketCompareRes, roles: "the user who started the job", tinyfish: "Agent runs (status), Fetch" },
  { path: "/api/hospitals/info", tag: "Appointments", summary: "Get a hospital's OPD timings", description: "Department-wise OPD days and timings taken from the hospital's own pages, with the source link. Cached for 7 days.", req: c.HospitalInfoReq, res: c.HospitalInfoRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/care-plan", tag: "Care", summary: "Generate a care plan for a condition", description: "Built only from trusted guideline pages; every section keeps its sources and the plan never mentions medicines or doses. A doctor's request creates a `draft` the doctor must approve; a patient's request creates a plan marked as not reviewed by a doctor.", req: c.GenerateCarePlanReq, res: c.GenerateCarePlanRes, roles: "patient, or the patient's doctor", tinyfish: "Search, Fetch" },
  { path: "/api/medicines/interactions", tag: "Care", summary: "Check the user's medicines for interactions", description: "Reports an interaction only when a trusted source states it, with the quoted sentence. When none is found, the response lists the sources that were checked; it never calls a combination safe.", req: c.InteractionsReq, res: c.InteractionsRes, roles: "patient", tinyfish: "Search, Fetch" },
  { path: "/api/triage", tag: "Care", summary: "Check symptoms and suggest a department", description: "Fixed warning-sign rules run first and return `emergency` (call 108 / SOS) without any AI. Otherwise suggests departments from the hospital department list. Never names a disease.", req: c.TriageReq, res: c.TriageRes, roles: "any signed-in user" },
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
      "Request: `{ session_id?: string, messages: UIMessage[] }` (Vercel AI SDK UI messages). Response: an AI SDK UI-message stream. A new session id is returned in the `x-session-id` header. Answers cite trusted sources; emergency messages start with a 108 / SOS notice.\n\n**Who can call it:** any signed-in user.\n\n**TinyFish:** Search, Fetch (as assistant tools).",
    operationId: "assistant_chat",
    responses: {
      "200": { description: "Server-sent UI message stream", headers: { "x-session-id": { schema: { type: "string", format: "uuid" } } } },
      "401": errorResponse("Missing or invalid token (`UNAUTHORIZED`)"),
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
    { name: "Wellness", description: "Medicine quality alerts" },
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
