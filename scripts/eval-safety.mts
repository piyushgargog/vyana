/**
 * The model-dependent safety suites of EVALUATION §6, run against the running API with the real model:
 * no diagnosis (triage + assistant), no dose advice, no fabricated citations, care plan lines. Every case must pass;
 * any failure blocks the release and is listed with the reply that failed.
 *
 * Start the app with the candidate provider (LLM_MOCK=0, LLM_PROVIDER, LLM_MODEL and its API key), the Supabase keys in
 * apps/web/.env.local and the seed applied, then:
 *
 *   pnpm eval:safety                 # all suites
 *   pnpm eval:safety no-dose         # one suite: no-diagnosis | no-dose | citations | care-plan
 *
 * Record the result in docs/PROGRESS.md: date · provider/model · prompt versions · pass/fail per suite.
 */
import { fileURLToPath } from "node:url";
import carePlanSuite from "../apps/web/tests/safety/care-plan.json" with { type: "json" };
import citationsSuite from "../apps/web/tests/safety/citations.json" with { type: "json" };
import noDiagnosisSuite from "../apps/web/tests/safety/no-diagnosis.json" with { type: "json" };
import noDoseSuite from "../apps/web/tests/safety/no-dose.json" with { type: "json" };
import { scoreCitations, scoreNoDiagnosis, scoreNoDose, scorePlanLines, textFromSse, toolUrlsFromSse, type Score } from "../apps/web/tests/safety/score";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}

const API = (process.env.API_BASE ?? "http://localhost:3000").replace(/\/+$/, "");
const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PASSWORD = process.env.SEED_PASSWORD ?? "";
if (!SB_URL || !SB_KEY || !PASSWORD) {
  console.error("NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SEED_PASSWORD are needed in apps/web/.env.local.");
  process.exit(1);
}
const only = process.argv[2];
const wanted = (suite: string) => !only || only === suite;

async function signIn(email: string): Promise<{ token: string; id: string }> {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = (await res.json()) as { access_token?: string; user?: { id: string } };
  if (!res.ok || !body.access_token || !body.user) throw new Error(`sign-in as ${email} failed`);
  return { token: body.access_token, id: body.user.id };
}

async function post(path: string, token: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  return { status: res.status, text: await res.text() };
}

const ask = (token: string, question: string) =>
  post("/api/assistant/chat", token, { messages: [{ id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: question }] }] });

interface Row {
  suite: string;
  input: string;
  score: Score;
  detail?: string;
}
const rows: Row[] = [];
const record = (suite: string, input: string, score: Score, detail?: string) => {
  rows.push({ suite, input, score, detail });
  console.log(`${score.pass ? "PASS" : "FAIL"}  ${suite.padEnd(18)} ${input.slice(0, 70)}${score.pass ? "" : `  - ${score.why.join("; ")}`}`);
};

const patient = await signIn("patient@vyana.test").catch((err) => {
  console.error(`Cannot sign in as the demo patient: ${err instanceof Error ? err.message : err}. Check the Supabase keys and that the seed has run.`);
  process.exit(1);
});
console.log(`Safety eval of ${API}\n`);

if (wanted("no-diagnosis")) {
  const s = noDiagnosisSuite;
  for (const symptoms of s.triage) {
    const r = await post("/api/triage", patient.token, { symptoms });
    const body = r.status === 200 ? JSON.parse(r.text) : null;
    const text = body ? [body.advice, body.disclaimer, ...body.red_flags, ...body.departments].join(". ") : "";
    record("no-diagnosis/triage", symptoms, body ? scoreNoDiagnosis(text) : { pass: false, why: [`status ${r.status}`] });
  }
  for (const q of s.assistant) {
    const r = await ask(patient.token, q);
    record("no-diagnosis/chat", q, r.status === 200 ? scoreNoDiagnosis(textFromSse(r.text)) : { pass: false, why: [`status ${r.status}`] });
  }
}

if (wanted("no-dose")) {
  for (const q of noDoseSuite.assistant) {
    const r = await ask(patient.token, q);
    record("no-dose", q, r.status === 200 ? scoreNoDose(textFromSse(r.text)) : { pass: false, why: [`status ${r.status}`] });
  }
}

if (wanted("citations")) {
  let withLink = 0;
  const qs = citationsSuite.assistant;
  for (const q of qs) {
    const r = await ask(patient.token, q);
    if (r.status !== 200) {
      record("citations", q, { pass: false, why: [`status ${r.status}`] });
      continue;
    }
    const score = scoreCitations(textFromSse(r.text), toolUrlsFromSse(r.text));
    if (score.links > 0) withLink++;
    record("citations", q, score);
  }
  console.log(`      ${withLink}/${qs.length} health answers cite at least one fetched link (the bar is: 0 links outside the fetched set)`);
}

if (wanted("care-plan")) {
  for (const name of carePlanSuite.conditions) {
    const made = await fetch(`${SB_URL}/rest/v1/conditions`, {
      method: "POST",
      headers: { apikey: SB_KEY, authorization: `Bearer ${patient.token}`, "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ patient_id: patient.id, name, source: "patient" }),
    });
    const cond = (await made.json()) as { id?: string }[];
    if (!made.ok || !cond[0]?.id) {
      record("care-plan", name, { pass: false, why: ["could not add the condition"] });
      continue;
    }
    const r = await post("/api/care-plan", patient.token, { condition_id: cond[0].id });
    if (r.status !== 200) {
      record("care-plan", name, { pass: false, why: [`status ${r.status}: ${r.text.slice(0, 100)}`] });
      continue;
    }
    const plan = JSON.parse(r.text).plan as { summary: string; do: string[]; dont: string[]; diet: { eat_more: string[]; limit: string[] }; red_flags: string[]; sources: unknown[] };
    const dose = scorePlanLines([plan.summary, ...plan.do, ...plan.dont, ...plan.red_flags]);
    const diet = scorePlanLines([...plan.diet.eat_more, ...plan.diet.limit], { diet: true });
    const why = [...dose.why, ...diet.why, ...(plan.sources.length ? [] : ["no sources"])];
    record("care-plan", name, { pass: why.length === 0, why });
  }
}

const bySuite = new Map<string, { pass: number; total: number }>();
for (const r of rows) {
  const s = bySuite.get(r.suite) ?? { pass: 0, total: 0 };
  s.total++;
  if (r.score.pass) s.pass++;
  bySuite.set(r.suite, s);
}
console.log("\nResult");
for (const [suite, s] of bySuite) console.log(`  ${s.pass === s.total ? "PASS" : "FAIL"}  ${suite.padEnd(20)} ${s.pass}/${s.total}`);
const failed = rows.filter((r) => !r.score.pass).length;
console.log(failed ? `\n${failed} case(s) failed: this blocks the release.` : "\nEvery case passed.");
process.exit(failed ? 1 : 0);
