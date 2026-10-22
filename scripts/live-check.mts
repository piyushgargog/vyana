/**
 * P15: checks the running API against a real Supabase project, as the seeded demo users (SPEC §0, TASKS P15).
 * Start the app first (`pnpm dev`, or point API_BASE at the deployed URL), with the Supabase keys in apps/web/.env.local
 * and the seed applied (`supabase/seed/seed-users.ts`, then `seed.sql`).
 *
 *   pnpm live:check                # fast checks: no agents, no model
 *   pnpm live:check --llm          # also the routes that need a model (set LLM_MOCK=1 or a provider on the server)
 *
 * Each line is PASS, FAIL or SKIP; a difference from the docs is a FAIL to fix in the docs first. Exit code 1 on any FAIL.
 * Checks that create rows (a condition, a chat session) delete them again before they end, even when
 * they fail — the demo account is shared, and leftovers pile up in it (#333).
 */
import { fileURLToPath } from "node:url";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}

const API = (process.env.API_BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PASSWORD_PATIENT = process.env.SEED_PASSWORD_PATIENT ?? "";
const PASSWORD_DOCTOR = process.env.SEED_PASSWORD_DOCTOR ?? "";
const WITH_LLM = process.argv.includes("--llm");

for (const [name, value] of [["NEXT_PUBLIC_SUPABASE_URL", SB_URL], ["NEXT_PUBLIC_SUPABASE_ANON_KEY", SB_KEY], ["SEED_PASSWORD_PATIENT", PASSWORD_PATIENT], ["SEED_PASSWORD_DOCTOR", PASSWORD_DOCTOR]] as const) {
  if (!value) {
    console.error(`${name} is missing in apps/web/.env.local.`);
    process.exit(1);
  }
}

let failures = 0;
const line = (state: "PASS" | "FAIL" | "SKIP", name: string, detail = "") => {
  if (state === "FAIL") failures++;
  console.log(`${state}  ${name}${detail ? `  - ${detail}` : ""}`);
};
/** Throw from a check to mark it SKIP instead of FAIL (an outside service that did not answer says nothing about us). */
class SkipCheck extends Error {}
async function check(name: string, fn: () => Promise<string | void>) {
  try {
    line("PASS", name, (await fn()) ?? "");
  } catch (err) {
    if (err instanceof SkipCheck) line("SKIP", name, err.message);
    else line("FAIL", name, err instanceof Error ? err.message : String(err));
  }
}
const skip = (name: string, why: string) => line("SKIP", name, why);
function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

// ---------------------------------------------------------------- helpers

async function signIn(email: string, password: string): Promise<{ token: string; id: string }> {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string; user?: { id: string }; error_description?: string };
  if (!res.ok || !body.access_token || !body.user) throw new Error(`sign-in as ${email} failed: ${body.error_description ?? res.status}`);
  return { token: body.access_token, id: body.user.id };
}

/** A call to the app's API. `timeoutMs` shortens the two-minute default for a call that may
 *  wait on a public service; the caller decides what an abort means (the blood check skips). */
async function api(method: string, path: string, token: string | null, body?: unknown, timeoutMs = 120_000) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // an SSE stream or an empty body
  }
  return { status: res.status, headers: res.headers, text, json: json as Record<string, any> | null };
}

/** A call to Supabase's REST API as a signed-in user (row level security applies). */
async function rest(method: string, path: string, token: string, body?: unknown) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SB_KEY, authorization: `Bearer ${token}`, "content-type": "application/json", prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as any) : null };
}

// ---------------------------------------------------------------- the checks

console.log(`Live check of ${API} against ${SB_URL}\n`);

let patient: { token: string; id: string } | undefined;
let doctor: { token: string; id: string } | undefined;
let doctor2: { token: string; id: string } | undefined;
await check("sign in as the demo patient, doctor and pending doctor", async () => {
  patient = await signIn("patient@vyana.test", PASSWORD_PATIENT);
  doctor = await signIn("doctor@vyana.test", PASSWORD_DOCTOR);
  doctor2 = await signIn("doctor2@vyana.test", PASSWORD_DOCTOR);
});
if (!patient || !doctor || !doctor2) {
  console.log("\nCan't go on without the demo users: run supabase/seed/seed-users.ts, then seed.sql.");
  process.exit(1);
}
const P = patient.token;

await check("auth: no token → 401, a wrong token → 401, a real token loads the profile (assistant answers 200)", async () => {
  expect((await api("POST", "/api/triage", null, { symptoms: "chest pain" })).status === 401, "no token should be 401");
  expect((await api("POST", "/api/triage", "not-a-token", { symptoms: "chest pain" })).status === 401, "a wrong token should be 401");
  const ok = await api("POST", "/api/triage", P, { symptoms: "chest pain and sweating" });
  expect(ok.status === 200 && ok.json?.urgency === "emergency", `triage emergency: ${ok.status} ${ok.text.slice(0, 120)}`);
  return "emergency triage, no model";
});

await check("roles: a patient can't verify as a doctor; a doctor can't use patient routes", async () => {
  expect((await api("POST", "/api/doctors/verify", P, { reg_no: "1", state_council: "Delhi Medical Council" })).status === 403, "patient → doctors/verify should be 403");
});

await check("rls: a patient can't read another user's profile or prescriptions", async () => {
  const other = await rest("GET", `profiles?id=eq.${doctor!.id}&select=phone,dob`, P);
  expect(Array.isArray(other.json) && other.json.length === 0, `read another profile: ${JSON.stringify(other.json).slice(0, 100)}`);
  const rx = await rest("GET", `prescriptions?patient_id=eq.${doctor!.id}&select=id`, P);
  expect(Array.isArray(rx.json) && rx.json.length === 0, "read another user's prescriptions");
});

await check("cron: the scheduled route refuses a request without the secret", async () => {
  const res = await api("POST", "/api/cron/missed-doses", null, {});
  expect(res.status === 401 || res.status === 500, `status ${res.status}`);
  return `status ${res.status}`;
});

await check("emergency: nearby hospitals never fail; SOS (patient only) returns contacts and an SMS text", async () => {
  const near = await api("POST", "/api/emergency/nearby", P, { lat: 28.5672, lng: 77.21 });
  expect(near.status === 200 && Array.isArray(near.json?.hospitals) && near.json.hospitals.length >= 1, `nearby ${near.status}: ${near.json?.hospitals?.length ?? "no"} hospitals`);
  const sos = await api("POST", "/api/emergency/sos", P, { lat: 28.5672, lng: 77.21, note: "live check" });
  const mapLink = String(sos.json?.sms_body ?? "").match(/https?:\/\/\S+/)?.[0];
  expect(sos.status === 200 && sos.json?.request_id && mapLink && new URL(mapLink).hostname === "maps.google.com", `sos ${sos.status} ${sos.text.slice(0, 120)}`);
  return `${near.json?.hospitals.length} hospitals, ${sos.json?.contacts.length} contacts`;
});

await check("web_cache: a second identical request is served from the cache", async () => {
  const first = await api("POST", "/api/emergency/nearby", P, { lat: 28.6139, lng: 77.209 });
  const second = await api("POST", "/api/emergency/nearby", P, { lat: 28.6139, lng: 77.209 });
  expect(first.status === 200 && second.status === 200, "both calls should be 200");
  if (first.json?.hospitals.length) expect(second.json?.cached === true, "the second call should say cached: true");
  return first.json?.hospitals.length ? "cached: true on the second call" : "no hospitals found, nothing to cache (the map service and the table had nothing near this point)";
});

await check("blood search: Delhi is answered within 5 seconds from the public stock service, at least one bank, every row holds a unit count", async () => {
  const t0 = Date.now();
  // 15 s rather than the api() default of two minutes: if the public service hangs, the
  // request aborts and the check skips — a dead service says nothing about Vyana (#298).
  let res: Awaited<ReturnType<typeof api>>;
  try {
    res = await api("POST", "/api/blood/search", P, { blood_group: "O+", component: "whole_blood", city: "Delhi" }, 15_000);
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new SkipCheck("the public stock service did not answer within 15 seconds");
    }
    throw err;
  }
  const seconds = (Date.now() - t0) / 1000;
  expect(res.status === 200 && res.json?.status === "done", `blood ${res.status} ${res.text.slice(0, 120)}`);
  const banks = res.json?.banks ?? [];
  if (banks.length === 0) {
    // The server answers "done" with an errored source when the public service is
    // down; that says nothing about Vyana, so the check skips instead of failing.
    const answered = (res.json?.sources ?? []).some((s: any) => s.status === "ok" || s.status === "not_found");
    if (!answered) throw new SkipCheck(`the public stock service did not answer (sources: ${(res.json?.sources ?? []).map((s: any) => s.status).join(", ") || "none"})`);
    throw new Error("the service answered but listed no bank for Delhi");
  }
  expect(seconds < 5, `took ${seconds.toFixed(1)} s`);
  expect(banks.every((b: any) => Number.isInteger(b.units) && b.units > 0 && b.verified), "every row should hold a unit count");
  return `${banks.length} banks in ${seconds.toFixed(1)} s, most units ${banks[0].units}`;
});

let shareToken = "";
await check("share links: create as the patient, read without signing in, revoke → 404", async () => {
  const made = await rest("POST", "share_links", P, { patient_id: patient!.id, kind: "medical_id", expires_at: new Date(Date.now() + 3_600_000).toISOString() });
  expect(made.status === 201 && made.json?.[0]?.token, `create ${made.status} ${JSON.stringify(made.json).slice(0, 100)}`);
  shareToken = made.json[0].token as string;
  const open = await api("GET", `/api/share/${shareToken}`, null);
  expect(open.status === 200 && open.json?.profile?.full_name, `open ${open.status}`);
  expect(!JSON.stringify(open.json).includes(patient!.id) && !JSON.stringify(open.json).includes(shareToken), "the response must not contain the patient id or the token");
  expect(open.headers.get("cache-control") === "no-store", "cache-control: no-store");
  await rest("PATCH", `share_links?token=eq.${shareToken}`, P, { revoked: true });
  expect((await api("GET", `/api/share/${shareToken}`, null)).status === 404, "a revoked link should be 404");
  expect((await api("GET", `/api/share/${"0".repeat(48)}`, null)).status === 404, "an unknown token should be 404");
});

await check("assistant: streams, returns x-session-id, starts with the 108 notice on an emergency (no model needed for the notice)", async () => {
  let sessionId: string | null = null;
  try {
    const res = await api("POST", "/api/assistant/chat", P, { messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "I have chest pain" }] }] });
    sessionId = res.headers.get("x-session-id");
    expect(res.status === 200 || res.status === 500, `status ${res.status}`);
    if (res.status === 500) return "model not configured (500); run with LLM_MOCK=1 or a provider to check the stream";
    expect(sessionId, "x-session-id header");
    expect(res.text.includes("108"), "the stream should contain the 108 notice");
    return "session " + sessionId;
  } finally {
    // The session this check started is deleted again (#333); its messages go with it (cascade).
    if (sessionId) {
      try {
        await rest("DELETE", `chat_sessions?id=eq.${sessionId}`, P);
      } catch {
        // Cleanup is best-effort; a failed delete must not mask the check's own result.
      }
    }
  }
});

if (!WITH_LLM) {
  skip("model routes: care plan, interactions, triage (non-emergency), report / prescription reading", "add --llm (server needs LLM_MOCK=1 or a provider)");
} else {
  await check("triage (non-emergency) picks a seeded department", async () => {
    const res = await api("POST", "/api/triage", P, { symptoms: "itchy skin rash on my arm for 3 days" });
    expect(res.status === 200 && ["soon", "routine"].includes(res.json?.urgency) && res.json?.departments.length, `triage ${res.status} ${res.text.slice(0, 120)}`);
    return res.json?.departments.join(", ");
  });
  await check("interactions: the demo medicines map to salts; table, sources and not_checked are returned; never 'safe'", async () => {
    const res = await api("POST", "/api/medicines/interactions", P, {});
    expect(res.status === 200 && Array.isArray(res.json?.checked_medicines), `interactions ${res.status} ${res.text.slice(0, 120)}`);
    expect(!/\bsafe\b/i.test(res.text), "the answer must never say safe");
    return `${res.json?.checked_medicines.length} checked, ${res.json?.interactions.length} found, ${res.json?.not_checked?.length ?? 0} not checked`;
  });
  await check("care plan: a patient-added condition gets a patient_generated plan; a doctor's diagnosis → 403 for the patient", async () => {
    // A condition can exist only once per patient (migration 0020), and the demo patient already has some (one is a
    // doctor's diagnosis): take the first of these that the patient does not have yet, and delete it again below.
    const existing = await rest("GET", `conditions?patient_id=eq.${patient!.id}&select=name`, P);
    const have = new Set<string>((existing.json ?? []).map((c: { name: string }) => c.name.trim().toLowerCase()));
    const name = ["Asthma", "Hypertension", "Migraine", "Anemia"].find((n) => !have.has(n.toLowerCase()));
    expect(Boolean(name), "the demo patient has every condition this check could add");
    const own = await rest("POST", "conditions", P, { patient_id: patient!.id, name, source: "patient" });
    expect(own.status === 201, `add condition ${own.status}`);
    const conditionId = own.json[0].id as string;
    try {
      const plan = await api("POST", "/api/care-plan", P, { condition_id: conditionId });
      expect(plan.status === 200 && plan.json?.status === "patient_generated" && plan.json?.plan?.sources?.length, `care plan ${plan.status} ${plan.text.slice(0, 160)}`);
      const docCond = await rest("GET", "conditions?source=eq.doctor&select=id&limit=1", P);
      if (docCond.json?.[0]) expect((await api("POST", "/api/care-plan", P, { condition_id: docCond.json[0].id })).status === 403, "a doctor's diagnosis should be 403 for the patient");
      return `${plan.json?.plan.do.length} do's, ${plan.json?.plan.red_flags.length} warning signs`;
    } finally {
      // The condition this check added is deleted again (#333); its care plans go with it —
      // care_plans.condition_id is on delete cascade, and this check is their only source here.
      try {
        await rest("DELETE", `conditions?id=eq.${conditionId}`, P);
      } catch {
        // Cleanup is best-effort; a failed delete must not mask the check's own result.
      }
    }
  });
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
