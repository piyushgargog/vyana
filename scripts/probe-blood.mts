/**
 * R1 probe (v1.1.0): what does the public blood availability search look like? Search and Fetch are free; the agent
 * run (`--agent`) costs credits.
 *
 *   pnpm exec tsx --conditions=react-server scripts/probe-blood.mts "Delhi"
 *   pnpm exec tsx --conditions=react-server scripts/probe-blood.mts "Delhi" --agent
 */
import { fileURLToPath } from "node:url";
import { fetchPages, runAgent, search } from "../apps/web/lib/server/tinyfish/client";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}
if (process.env.TINYFISH_MOCK === "1") {
  console.error("TINYFISH_MOCK=1 is set: unset it for a live probe.");
  process.exit(1);
}

const city = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "Delhi";
const withAgent = process.argv.includes("--agent");

console.log("=== Search (free) ===");
const found = new Map<string, string>();
for (const query of ["e-RaktKosh blood availability search", `blood bank stock availability ${city}`]) {
  const res = await search({ query, location: "IN" });
  for (const r of res.results.slice(0, 6)) found.set(r.url, r.title);
}
for (const [url, title] of found) console.log(`  ${title}\n    ${url}`);

console.log("\n=== Fetch (free): first 600 characters of each page ===");
const urls = [...found.keys()].slice(0, 6);
if (urls.length) {
  const res = await fetchPages({ urls, ttl: 0, purpose: "Look at a public blood availability page" });
  for (const r of res.results) console.log(`\n  ${r.url}\n    ${(r.text ?? "").replace(/\s+/g, " ").slice(0, 600)}`);
}

if (withAgent) {
  console.log("\n=== Agent (paid) ===");
  const start = urls.find((u) => /eraktkosh/i.test(u)) ?? "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt";
  const out = await runAgent(
    {
      url: start,
      goal: `Open the public blood availability search. Search for blood group O+ whole blood in ${city}. Do not log in. If a CAPTCHA or login appears, stop and return found=false with reason. Otherwise return up to 5 blood banks as shown: name, address, phone, units, component, the page's own "updated" text.`,
      output_schema: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          reason: { type: "string", nullable: true },
          banks: { type: "array", items: { type: "object", properties: { name: { type: "string" }, address: { type: "string", nullable: true }, phone: { type: "string", nullable: true }, units: { type: "number", nullable: true }, component: { type: "string", nullable: true }, updated: { type: "string", nullable: true } }, required: ["name"] } },
        },
        required: ["found"],
      },
      browser_profile: "stealth",
    },
    { timeoutMs: 150_000 },
  );
  console.log(JSON.stringify(out, null, 2));
}
