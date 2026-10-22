/**
 * Load test for the hot routes (issue #303). See README.md in this folder for
 * how to run it: local or staging only, mock model, never the live site.
 *
 *   k6 run -e SCENARIO=me scripts/load/main.js
 *   k6 run -e SCENARIO=dashboard -e QUICK=1 scripts/load/main.js
 *   k6 run -e SCENARIO=care-plan -e CONFIRM_MOCK_LLM=1 scripts/load/main.js   (mock-model builds only)
 *
 * Scenarios: dashboard, me, blood, care-plan, assistant, share.
 * Each run ends with a small table: requests, error rate, p50 and p95.
 */
import { check, fail } from "k6";
import http from "k6/http";
import { Trend } from "k6/metrics";

const BASE = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const SB = (__ENV.SUPABASE_URL || "http://localhost:54321").replace(/\/+$/, "");
const ANON = __ENV.SUPABASE_ANON_KEY || "";
const EMAIL = __ENV.PATIENT_EMAIL || "patient@vyana.test";
const PASSWORD = __ENV.PATIENT_PASSWORD || "";
const SCENARIO = __ENV.SCENARIO || "me";
const QUICK = __ENV.QUICK === "1";

// Allow-list, not a block-list: the target must be this machine, or exactly
// the staging URL named in STAGING_URL. Anything else — the live site under
// any name, the server's own address, a lookalike host — is refused before a
// single request is made.
const STAGING = (__ENV.STAGING_URL || "").replace(/\/+$/, "");
function hostOf(raw) {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(raw);
  if (!m) return "";
  // "[::1]:3000" → "::1"; "localhost:3000" → "localhost"
  return m[1].replace(/^\[/, "").split(/[:\]]/)[0].toLowerCase();
}
function isAllowedTarget(raw) {
  const host = hostOf(raw);
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  return STAGING !== "" && raw === STAGING;
}
if (!isAllowedTarget(BASE) || !isAllowedTarget(SB)) {
  throw new Error(
    "Refusing to run: BASE_URL and SUPABASE_URL must be localhost, 127.0.0.1, or exactly the STAGING_URL you set. Load tests run nowhere else.",
  );
}
if (!ANON || !PASSWORD) {
  throw new Error("Set SUPABASE_ANON_KEY and PATIENT_PASSWORD (see scripts/load/README.md).");
}
// The care-plan and assistant scenarios spend model calls and write real
// rows (plans, chat messages, ai_runs) wherever they point. They run only
// against a build started with LLM_MOCK=1, and only when the person running
// the test says so out loud:
if ((SCENARIO === "care-plan" || SCENARIO === "assistant") && __ENV.CONFIRM_MOCK_LLM !== "1") {
  throw new Error(
    "The care-plan and assistant scenarios call the model: run them only against a build with LLM_MOCK=1, and pass -e CONFIRM_MOCK_LLM=1 to confirm the target is that build.",
  );
}

const duration = new Trend("route_duration", true);

export const options = {
  scenarios: {
    load: QUICK
      ? { executor: "constant-vus", vus: 1, duration: "10s" }
      : {
          executor: "ramping-vus",
          startVUs: 0,
          stages: [
            { target: 10, duration: "30s" },
            { target: 10, duration: "1m" },
            { target: 50, duration: "30s" },
            { target: 50, duration: "1m" },
            { target: 100, duration: "30s" },
            { target: 100, duration: "1m" },
            { target: 0, duration: "15s" },
          ],
        },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    route_duration: SCENARIO === "care-plan" || SCENARIO === "assistant" ? ["p(95)<5000"] : ["p(95)<2000"],
  },
};

function record(res, name) {
  duration.add(res.timings.duration, { route: name });
  check(res, { [`${name}: status 200`]: (r) => r.status === 200 });
  return res;
}

/** Sign in as the demo patient and gather what the scenarios need. Returns data shared by every VU. */
export function setup() {
  const signIn = http.post(
    `${SB}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { apikey: ANON, "content-type": "application/json" } },
  );
  if (signIn.status !== 200) fail(`sign-in failed (${signIn.status}): set PATIENT_PASSWORD to the demo password`);
  const token = signIn.json("access_token");
  const userId = signIn.json("user.id");
  const auth = { headers: { apikey: ANON, authorization: `Bearer ${token}`, "content-type": "application/json" } };

  // Warm the blood search once: the app caches the public service's answer
  // for 15 minutes, so without this the early virtual users would measure
  // the cold upstream fetch instead of Vyana. The reply is not recorded.
  http.post(
    `${BASE}/api/blood/search`,
    JSON.stringify({ blood_group: "O+", component: "whole_blood", city: "Delhi" }),
    { headers: { authorization: `Bearer ${token}`, "content-type": "application/json" } },
  );

  // The care plan scenario needs one of the patient's own conditions.
  const conditions = http.get(`${SB}/rest/v1/conditions?patient_id=eq.${userId}&select=id&limit=1`, auth);
  const conditionId = conditions.status === 200 && conditions.json()[0] ? conditions.json()[0].id : null;

  // The share scenario reads a link this run creates (revoked in teardown).
  const made = http.post(
    `${SB}/rest/v1/share_links`,
    JSON.stringify({ patient_id: userId, kind: "medical_id", expires_at: new Date(Date.now() + 3600_000).toISOString() }),
    { headers: { ...auth.headers, prefer: "return=representation" } },
  );
  const shareToken = made.status === 201 && made.json()[0] ? made.json()[0].token : null;

  return { token, userId, conditionId, shareToken, auth };
}

export function teardown(data) {
  if (data.shareToken) {
    http.patch(`${SB}/rest/v1/share_links?token=eq.${data.shareToken}`, JSON.stringify({ revoked: true }), data.auth);
  }
}

const flows = {
  // The dashboard's own reads, the way the browser makes them.
  dashboard(data) {
    const rest = { headers: { apikey: ANON, authorization: `Bearer ${data.token}` } };
    record(http.get(`${SB}/rest/v1/profiles?id=eq.${data.userId}&select=*`, rest), "dashboard");
    record(http.get(`${SB}/rest/v1/dose_logs?patient_id=eq.${data.userId}&select=*&order=scheduled_for`, rest), "dashboard");
    record(http.get(`${SB}/rest/v1/prescription_items?patient_id=eq.${data.userId}&active=eq.true&select=*`, rest), "dashboard");
  },
  me(data) {
    record(http.get(`${BASE}/api/me`, { headers: { authorization: `Bearer ${data.token}` } }), "me");
  },
  blood(data) {
    const res = http.post(
      `${BASE}/api/blood/search`,
      JSON.stringify({ blood_group: "O+", component: "whole_blood", city: "Delhi" }),
      { headers: { authorization: `Bearer ${data.token}`, "content-type": "application/json" } },
    );
    record(res, "blood");
  },
  "care-plan"(data) {
    if (!data.conditionId) fail("the demo patient has no condition to plan for; apply the seed");
    const res = http.post(
      `${BASE}/api/care-plan`,
      JSON.stringify({ condition_id: data.conditionId }),
      { headers: { authorization: `Bearer ${data.token}`, "content-type": "application/json" } },
    );
    record(res, "care-plan");
  },
  assistant(data) {
    const res = http.post(
      `${BASE}/api/assistant/chat`,
      JSON.stringify({ messages: [{ id: "load-1", role: "user", parts: [{ type: "text", text: "What is my next dose?" }] }] }),
      { headers: { authorization: `Bearer ${data.token}`, "content-type": "application/json" } },
    );
    record(res, "assistant");
  },
  share(data) {
    if (!data.shareToken) fail("setup could not create a share link");
    record(http.get(`${BASE}/api/share/${data.shareToken}`), "share");
  },
};

export default function (data) {
  const flow = flows[SCENARIO];
  if (!flow) fail(`unknown SCENARIO ${SCENARIO} (dashboard, me, blood, care-plan, assistant, share)`);
  flow(data);
}

export function handleSummary(data) {
  const m = data.metrics;
  const rows = [
    ["requests", m.http_reqs ? m.http_reqs.values.count : 0],
    ["error rate", m.http_req_failed ? `${(m.http_req_failed.values.rate * 100).toFixed(2)}%` : "n/a"],
    ["p50 (ms)", m.route_duration ? Math.round(m.route_duration.values["p(50)"]) : "n/a"],
    ["p95 (ms)", m.route_duration ? Math.round(m.route_duration.values["p(95)"]) : "n/a"],
  ];
  const text = `\nScenario: ${SCENARIO}\n` + rows.map(([k, v]) => `  ${k.padEnd(12)} ${v}`).join("\n") + "\n";
  return { stdout: text };
}
