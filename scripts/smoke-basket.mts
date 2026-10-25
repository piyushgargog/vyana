/**
 * Live check of the basket pipeline without Supabase (SPEC §12): starts one async agent per pharmacy, polls them,
 * then maps, checks and price-verifies each result exactly as GET /api/prescriptions/basket/{job_id} does.
 * Uses agent credits.
 *
 *   pnpm smoke:basket                                  # Dolo 650 mg, Telma 40 mg, Pan 40 mg
 *   pnpm smoke:basket "Crocin Advance" "Shelcal 500"   # your own list
 */
import { fileURLToPath } from "node:url";
import type { PharmacyBasket } from "@vyana/shared";
import {
  BASKET_OUTPUT_SCHEMA,
  QUEUE_DEADLINE_MS,
  agentMaxSeconds,
  basketGoal,
  emptyBasket,
  itemLabel,
  normalizeItems,
  processPharmacyResult,
  runDeadlineMs,
  summarize,
} from "../apps/web/lib/server/tinyfish/basket";
import { cancelRun, getRun, startAgent } from "../apps/web/lib/server/tinyfish/client";
import { PHARMACIES } from "../apps/web/lib/server/tinyfish/sources";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}
if (process.env.TINYFISH_MOCK === "1") {
  console.error("TINYFISH_MOCK=1 is set: unset it for a live check.");
  process.exit(1);
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const items = normalizeItems(
  args.length
    ? args.map((a) => ({ medicine: a }))
    : [
        { medicine: "Dolo", strength: "650 mg" },
        { medicine: "Telma", strength: "40 mg" },
        { medicine: "Pan", strength: "40 mg" },
      ],
);
if (items.length > 10) {
  // The API prices at most 10 items, and the result processor verifies at most 10
  // product pages: a bigger list could only ever produce a partial smoke result.
  console.error(`The basket API takes at most 10 items; ${items.length} were given.`);
  process.exit(1);
}
console.log(`Basket: ${items.map(itemLabel).join(", ")}`);

const started = Date.now();
const counter = { tinyfishCalls: 0 };
const runs = await Promise.all(
  PHARMACIES.map(async (p) => ({
    pharmacy: p,
    start: await startAgent(
      { url: p.searchUrl(itemLabel(items[0])), goal: basketGoal(items, p), output_schema: BASKET_OUTPUT_SCHEMA, browser_profile: "stealth", maxSeconds: agentMaxSeconds(items.length) },
      { counter },
    ),
  })),
);
const secs = () => Math.round((Date.now() - started) / 1000);
for (const r of runs) console.log(`  ${r.pharmacy.name.padEnd(16)} ${r.start.status === "started" ? `started ${r.start.runId}` : `FAILED to start: ${r.start.error}`}`);

const results = new Map<string, PharmacyBasket>();
const seenRunning = new Set<string>();
for (const r of runs) if (r.start.status !== "started") results.set(r.pharmacy.source, emptyBasket(r.pharmacy.source, "error"));

while (results.size < runs.length) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await Promise.all(
    runs.map(async ({ pharmacy, start }) => {
      if (results.has(pharmacy.source) || start.status !== "started") return;
      const state = await getRun(start.runId, { counter });
      if (state.status === "RUNNING" && !seenRunning.has(pharmacy.source)) {
        seenRunning.add(pharmacy.source);
        console.log(`  [${secs()} s] ${pharmacy.name} left the queue and is running`);
      }
      if (state.status === "COMPLETED") {
        const t = Date.now();
        const basket = await processPharmacyResult(pharmacy, items, state.result, counter);
        results.set(pharmacy.source, basket);
        console.log(`  [${secs()} s] ${pharmacy.name} finished → ${basket.status} (verify ${Math.round((Date.now() - t) / 1000)} s)`);
      } else if (state.status === "FAILED" || state.status === "CANCELLED") {
        results.set(pharmacy.source, emptyBasket(pharmacy.source, state.error === "TIMEOUT" || state.status === "CANCELLED" ? "timeout" : "error"));
        console.log(`  [${secs()} s] ${pharmacy.name} ${state.status} ${state.error ?? ""}`);
      } else if (
        // The same rule as agentRunPollDecision: the queue deadline applies only
        // while the run has not started (PENDING); a started run is timed by its
        // own run deadline, counted from when it started.
        (state.status === "PENDING" && Date.now() - started > QUEUE_DEADLINE_MS) ||
        (state.status === "RUNNING" && state.startedAt !== null && Date.now() - state.startedAt > runDeadlineMs(items.length))
      ) {
        await cancelRun(start.runId, { counter });
        results.set(pharmacy.source, emptyBasket(pharmacy.source, "timeout"));
        console.log(`  [${secs()} s] ${pharmacy.name} gave up (deadline)`);
      }
    }),
  );
}

const summary = summarize([...results.values()]);
console.log(`\n=== Result after ${secs()} s, ${counter.tinyfishCalls} TinyFish calls ===`);
for (const b of summary.baskets) {
  console.log(`\n${b.source.padEnd(10)} ${b.status.padEnd(9)} total ${b.total ?? "-"}${b.missing.length ? `  missing: ${b.missing.join(", ")}` : ""}`);
  for (const l of b.lines) {
    if (!l.product_url) continue;
    console.log(`  ${l.price_verified ? "✓" : "?"} ${itemLabel(l).padEnd(14)} ${String(l.product_name).slice(0, 40).padEnd(40)} ₹${l.unit_price ?? "-"}  ${l.product_url}`);
  }
}
console.log(`\ncheapest complete: ${summary.cheapest_source ?? "none"} · savings vs highest: ${summary.savings_vs_highest ?? "-"}`);
const withTotals = summary.baskets.filter((b) => b.total !== null).length;
console.log(withTotals >= 3 ? "\nDone-when check: ≥3 baskets with totals ✓" : `\nDone-when check: only ${withTotals} baskets with totals`);
if (withTotals < 3) process.exit(1);
