// Generates apps/web/openapi.yaml from the Zod contracts, so the public API reference never drifts from the code.
// Run: pnpm docs:openapi   (CI fails if the committed file is out of date)
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { stringify } from "yaml";
import { toJSONSchema, type ZodType } from "zod";

import * as c from "../packages/shared/src/contracts/index.ts";

type Route = {
  path: string;
  summary: string;
  description: string;
  tag: string;
  req: ZodType | null;
  res: ZodType;
  roles: string;
  tinyfish?: string;
};

const routes: Route[] = [
  { path: "/api/medicines/compare", tag: "Prices", summary: "Compare a medicine's price across pharmacies", description: "Runs web agents on 1mg, PharmEasy, Netmeds and Apollo in parallel and looks up a Jan Aushadhi generic. Results are cached for 24 h. Sources that fail are reported in `sources[]`; the call still succeeds with the rest.", req: c.MedicinesCompareReq, res: c.MedicinesCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4, Search, Fetch" },
  { path: "/api/labs/compare", tag: "Prices", summary: "Compare a lab test's price across labs in a city", description: "Web agents on Healthians, Redcliffe, Thyrocare and 1mg Labs. Cached for 24 h.", req: c.LabsCompareReq, res: c.LabsCompareRes, roles: "any signed-in user", tinyfish: "Agent ×4" },
  { path: "/api/prescriptions/extract", tag: "Health records", summary: "Read an uploaded prescription", description: "Upload the file to the `prescriptions` bucket at `{user_id}/{uuid}.{ext}` first. The server reads it with a vision model, saves the prescription and its items, and returns them with reminder times filled in.", req: c.PrescriptionExtractReq, res: c.PrescriptionExtractRes, roles: "patient" },
  { path: "/api/reports/analyze", tag: "Health records", summary: "Analyze an uploaded lab report", description: "Upload the file to the `lab-reports` bucket first. Returns the values with reference ranges and high/low flags, and a plain-language summary (never a diagnosis).", req: c.ReportAnalyzeReq, res: c.ReportAnalyzeRes, roles: "patient" },
  { path: "/api/emergency/nearby", tag: "Emergency", summary: "Find nearby emergency hospitals", description: "Reverse-geocodes the location and finds hospitals with emergency/ICU care from the live web. Cached for 6 h per ~1 km area. Never fails: returns an empty list if nothing is found.", req: c.EmergencyNearbyReq, res: c.EmergencyNearbyRes, roles: "any signed-in user", tinyfish: "Search, Fetch" },
  { path: "/api/emergency/sos", tag: "Emergency", summary: "Raise an SOS", description: "Creates an emergency request, returns nearby hospitals, the user's emergency contacts and a ready-to-send SMS with a maps link. The request status updates live via Supabase Realtime.", req: c.EmergencySosReq, res: c.EmergencySosRes, roles: "patient" },
  { path: "/api/doctors/verify", tag: "Doctors", summary: "Verify a doctor against the NMC Indian Medical Register", description: "A web agent searches the official register and compares the result with the doctor's profile. Cached for 30 days.", req: c.DoctorVerifyReq, res: c.DoctorVerifyRes, roles: "doctor (verifies self)", tinyfish: "Agent" },
  { path: "/api/nutrition/plan", tag: "Wellness", summary: "Generate a diet plan for the user's conditions", description: "Grounded in trusted health sources found on the live web; the sources are returned with the plan.", req: c.NutritionPlanReq, res: c.NutritionPlanRes, roles: "patient", tinyfish: "Search, Fetch" },
  { path: "/api/alerts/check", tag: "Wellness", summary: "Check the user's medicines for quality alerts", description: "Searches recent CDSCO quality alerts and recalls for each active medicine and keeps only the genuinely relevant ones.", req: c.AlertsCheckReq, res: c.AlertsCheckRes, roles: "patient", tinyfish: "Search" },
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
  paths[r.path] = {
    post: {
      tags: [r.tag],
      summary: r.summary,
      description: `${r.description}\n\n**Who can call it:** ${r.roles}.${r.tinyfish ? `\n\n**TinyFish:** ${r.tinyfish}.` : ""}`,
      operationId: r.path.replace("/api/", "").replace(/\//g, "_"),
      ...(r.req ? { requestBody: { required: true, content: { "application/json": { schema: ref(nameOf(r.req), r.req) } } } } : {}),
      responses: {
        "200": { description: "Success", content: { "application/json": { schema: ref(nameOf(r.res), r.res) } } },
        "400": errorResponse("Invalid request body (`BAD_REQUEST`)"),
        "401": errorResponse("Missing or invalid token (`UNAUTHORIZED`)"),
        "403": errorResponse("Wrong role or not your file (`FORBIDDEN`)"),
        "502": errorResponse("An upstream service failed (`UPSTREAM_ERROR`)"),
        "504": errorResponse("An upstream service timed out (`UPSTREAM_TIMEOUT`)"),
      },
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
    { name: "Prices", description: "Live price comparison for medicines and lab tests" },
    { name: "Health records", description: "Reading prescriptions and lab reports" },
    { name: "Emergency", description: "SOS and nearby emergency hospitals" },
    { name: "Doctors", description: "Doctor verification" },
    { name: "Wellness", description: "Diet plans and medicine quality alerts" },
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
