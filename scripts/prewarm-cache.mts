/**
 * Fills the shared cache (`web_cache`) before a demo or recording (ADR-039): TinyFish runs 2 agents at a time, so a
 * live basket takes minutes; a prewarmed one answers at once. Only public data is cached, nothing about a patient.
 *
 * Steps that need no AI provider:
 *   1. Medicine baskets (4 pharmacy agents each): the demo prescription, then each of its medicines alone (the
 *      "Reorder" flow). Run one at a time, because the agents queue anyway.
 *   2. Care plan guideline pages for the demo conditions (Search + Fetch, free).
 *
 * Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (the cache lives in the database), TINYFISH_API_KEY and
 * JOB_TOKEN_SECRET in apps/web/.env.local. Uses agent credits (about 4 runs per uncached basket).
 *
 *   pnpm prewarm --dry-run    # prints the plan and the credit estimate, calls nothing
 *   pnpm prewarm              # runs it
 */
import { fileURLToPath } from "node:url";
import { guidelinePages } from "../apps/web/lib/server/tinyfish/guideline-pages";
import { itemLabel, normalizeItems, pollBasketJob, startBasketJob, type BasketItem } from "../apps/web/lib/server/tinyfish/basket";
import { PHARMACIES } from "../apps/web/lib/server/tinyfish/sources";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}

/** The demo patient's prescription (seed: patient@vyana.test). Change it here if the demo script changes. */
const DEMO_PRESCRIPTION = [
  { medicine: "Metformin", strength: "500 mg" },
  { medicine: "Telma (Telmisartan)", strength: "40 mg" },
  { medicine: "Dolo (Paracetamol)", strength: "650 mg" },
];
const DEMO_CONDITIONS = ["Type 2 Diabetes", "Hypertension"];

const POLL_MS = 15_000;
const BASKET_LIMIT_MS = 12 * 60_000;

const dryRun = process.argv.includes("--dry-run");
const baskets: BasketItem[][] = [normalizeItems(DEMO_PRESCRIPTION), ...DEMO_PRESCRIPTION.map((i) => normalizeItems([i]))];
const label = (b: BasketItem[]) => b.map(itemLabel).join(", ");

console.log("Prewarm plan");
for (const b of baskets) console.log(`  basket   ${label(b)}  (up to ${PHARMACIES.length} agent runs)`);
for (const c of DEMO_CONDITIONS) console.log(`  pages    care plan: ${c}  (Search + Fetch, free)`);
console.log(`At most ${baskets.length * PHARMACIES.length} agent runs; cached baskets cost nothing.\n`);
if (dryRun) process.exit(0);

if (process.env.TINYFISH_MOCK === "1") {
  console.error("TINYFISH_MOCK=1 is set: unset it to prewarm with live data.");
  process.exit(1);
}
for (const name of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "TINYFISH_API_KEY", "JOB_TOKEN_SECRET"]) {
  if (!process.env[name]) {
    console.error(`${name} is missing in apps/web/.env.local.`);
    process.exit(1);
  }
}

const counter = { tinyfishCalls: 0 };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;

for (const b of baskets) {
  const started = Date.now();
  let job = await startBasketJob("prewarm", b, counter);
  if (job.cached) {
    console.log(`CACHED  ${label(b)}`);
    continue;
  }
  while (job.status === "running" && Date.now() - started < BASKET_LIMIT_MS) {
    await sleep(POLL_MS);
    job = await pollBasketJob("prewarm", job.job_id, counter);
    const states = job.baskets.map((p) => `${p.source}:${p.status}`).join(" ");
    console.log(`  … ${Math.round((Date.now() - started) / 1000)} s  ${states}`);
  }
  const verified = job.baskets.filter((p) => p.lines.some((l) => l.price_verified)).length;
  // The job caches itself only when it finished with at least one verified price (pollBasketJob).
  const ok = job.status === "done" && verified > 0;
  if (!ok) failures++;
  console.log(`${ok ? "WARM   " : "FAILED "} ${label(b)}  (${verified}/${job.baskets.length} pharmacies with verified prices)`);
}

for (const c of DEMO_CONDITIONS) {
  try {
    const pages = await guidelinePages(c, counter);
    console.log(`${pages.length ? "WARM   " : "FAILED "} care plan pages: ${c}  (${pages.length} pages)`);
    if (!pages.length) failures++;
  } catch (err) {
    failures++;
    console.log(`FAILED  care plan pages: ${c}  (${err instanceof Error ? err.message : "error"})`);
  }
}

console.log(`\n${counter.tinyfishCalls} TinyFish calls. ${failures ? `${failures} step(s) failed: run again later.` : "Everything is warm."}`);
process.exit(failures ? 1 : 0);
