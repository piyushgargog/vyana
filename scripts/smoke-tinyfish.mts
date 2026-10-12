/**
 * Live smoke test for the TinyFish client (DESIGN §3):
 *   1. Search (free)
 *   2. Fetch of every agent start URL (free)
 *   3. One agent per pharmacy in parallel (paid): two over the sync endpoint, two over SSE with progress
 *   4. Create a Topic Monitor, then delete it (paid: the baseline run)
 *
 *   pnpm smoke:tinyfish                       # needs TINYFISH_API_KEY in apps/web/.env.local
 *   pnpm smoke:tinyfish --no-agent --no-monitor
 *   pnpm smoke:tinyfish --lite                 # agents use the faster "lite" browser instead of "stealth"
 */
import { fileURLToPath } from "node:url";
import { createSearchMonitor, deleteMonitor, fetchPages, runAgent, search, type AgentOutcome } from "../apps/web/lib/server/tinyfish/client";
import { NMC_REGISTER_URL, PHARMACIES, absoluteUrl, isOnDomain, type PharmacySource } from "../apps/web/lib/server/tinyfish/sources";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}
if (process.env.TINYFISH_MOCK === "1") {
  console.error("TINYFISH_MOCK=1 is set: unset it for a live smoke test.");
  process.exit(1);
}

const withAgent = !process.argv.includes("--no-agent");
const withMonitor = !process.argv.includes("--no-monitor");
const profile: "lite" | "stealth" = process.argv.includes("--lite") ? "lite" : "stealth";
const QUERY = "dolo 650";
let failures = 0;

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

// 1. Search
section("Search (free)");
const s = await search({ query: "paracetamol 650 Jan Aushadhi MRP", location: "IN" });
console.log(`${s.results.length} results`);
for (const r of s.results.slice(0, 3)) console.log(`  ${r.position}. ${r.title}\n     ${r.url}`);
if (!s.results.length) failures++;

const filtered = await search({ query: "metformin side effects", include_domains: ["medlineplus.gov"] });
const offDomain = filtered.results.filter((r) => !isOnDomain(r.url, "medlineplus.gov"));
console.log(`include_domains=medlineplus.gov → ${filtered.results.length} results, ${offDomain.length} off-domain`);
if (!filtered.results.length || offDomain.length) failures++;

// 2. Fetch every start URL the agents use
section("Fetch start URLs (free)");
const starts = [...PHARMACIES.map((p) => ({ name: p.name, url: p.searchUrl(QUERY) })), { name: "NMC register", url: NMC_REGISTER_URL }];
const f = await fetchPages({ urls: starts.map((x) => x.url), purpose: "Check that each start page still exists" }, { timeoutMs: 120_000 });
for (const { name, url } of starts) {
  const ok = f.results.find((r) => r.url === url);
  const err = f.errors.find((e) => e.url === url);
  if (ok) console.log(`  OK   ${name.padEnd(16)} ${ok.final_url ?? url}  (${(ok.text ?? "").length} chars)`);
  else {
    failures++;
    console.log(`  FAIL ${name.padEnd(16)} ${url}  → ${err?.error ?? "no result"}${err?.status ? ` ${err.status}` : ""}`);
  }
}

// 3. One agent per pharmacy, in parallel
interface Product {
  found: boolean;
  product_name?: string | null;
  pack_size?: string | null;
  price?: number | null;
  mrp?: number | null;
  in_stock?: boolean | null;
  product_url?: string | null;
}

async function priceOn(p: PharmacySource, useSse: boolean): Promise<[PharmacySource, AgentOutcome<Product>, number, boolean]> {
  const started = Date.now();
  const out = await runAgent<Product>(
    {
      url: p.searchUrl(QUERY),
      goal:
        "Find the product that best matches 'Dolo 650 tablet' in the search results. Do NOT log in, add to cart or buy. " +
        "Return found, product_name, pack_size, price and mrp in rupees as numbers, in_stock, and the full product_url (starting with https://) of the product page. " +
        "If nothing matches, return found=false.",
      output_schema: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          product_name: { type: "string", nullable: true },
          pack_size: { type: "string", nullable: true },
          price: { type: "number", nullable: true },
          mrp: { type: "number", nullable: true },
          in_stock: { type: "boolean", nullable: true },
          product_url: { type: "string", nullable: true },
        },
        required: ["found"],
      },
      browser_profile: profile,
      parse: (r) => {
        const v = r as Product;
        if (typeof v?.found !== "boolean") throw new Error("missing found");
        return v;
      },
      ...(useSse ? { onProgress: (msg: string) => console.log(`  … [${p.name}] ${msg}`) } : {}),
    },
    { timeoutMs: 120_000 },
  );
  return [p, out, Math.round((Date.now() - started) / 1000), useSse];
}

if (withAgent) {
  section(`Agents, one per pharmacy in parallel, ${profile} browser (uses credits)`);
  const runs = await Promise.all(PHARMACIES.map((p, i) => priceOn(p, i % 2 === 1)));
  for (const [p, out, secs, useSse] of runs) {
    const r = out.result;
    const productUrl = absoluteUrl(r?.product_url, p.searchUrl(QUERY));
    const onDomain = productUrl ? isOnDomain(productUrl, p.domain) : null;
    console.log(
      `  ${out.status === "ok" ? "OK  " : "FAIL"} ${p.name.padEnd(16)} ${useSse ? "sse " : "sync"} ${String(secs).padStart(3)} s  ` +
        (r ? `${r.product_name ?? "-"} | ${r.pack_size ?? "-"} | ₹${r.price ?? "-"} (MRP ₹${r.mrp ?? "-"}) | in stock: ${r.in_stock ?? "-"} | url on ${p.domain}: ${onDomain}` : `${out.error ?? ""}`),
    );
    if (r?.product_url) console.log(`       ${productUrl}${productUrl !== r.product_url ? `  (agent gave: ${r.product_url})` : ""}`);
    if (out.status !== "ok" || !r?.found || onDomain === false) failures++;
  }
} else {
  section("Agents skipped (--no-agent)");
}

// 4. Monitor: create, then clean up
if (withMonitor) {
  section("Topic Monitor create + delete (uses credits)");
  const m = await createSearchMonitor({
    name: "smoke test (deleted right away)",
    query: "CDSCO not of standard quality drug alert",
    schedule_cron: "0 6 * * *",
    result_limit: 3,
  });
  console.log(`  created ${m.id}`);
  await deleteMonitor(m.id);
  console.log("  deleted");
} else {
  section("Monitor skipped (--no-monitor)");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
